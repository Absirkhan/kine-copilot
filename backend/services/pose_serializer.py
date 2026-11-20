"""
Pose serialization for LLM consumption.
This module converts numerical pose data into structured text that an LLM can reason over.
This is the core multimodal bridging component.
"""

import numpy as np
from typing import Dict, List, Any
from models.schemas import PoseSequence, FramePose


def serialize_for_llm(pose_sequence: PoseSequence) -> str:
    """
    Convert a PoseSequence into LLM-readable structured text.

    This function transforms numerical skeletal data into a concise, well-formatted
    text representation that includes summary statistics, phase analysis, key moments,
    and a timeline sample. The output is optimized to be 400-800 tokens.

    Args:
        pose_sequence: Complete pose sequence with frames and metadata

    Returns:
        Structured text representation for LLM analysis
    """
    frames = pose_sequence.frames
    total_frames = len(frames)
    duration_s = total_frames / pose_sequence.fps if pose_sequence.fps > 0 else 0

    # Collect all joint angles across frames
    joint_data: Dict[str, List[float]] = {}
    for frame in frames:
        for joint_name, angle_value in frame.joint_angles.items():
            if joint_name not in joint_data:
                joint_data[joint_name] = []
            joint_data[joint_name].append(angle_value)

    # Compute summary statistics
    summary_stats = {}
    for joint_name, angles in joint_data.items():
        if angles:
            summary_stats[joint_name] = {
                "min": np.min(angles),
                "max": np.max(angles),
                "mean": np.mean(angles),
                "std": np.std(angles)
            }

    # Build the output text
    output_lines = []

    # Header
    output_lines.append("=== KINECOPILOT POSE ANALYSIS ===")
    output_lines.append(
        f"Sport: {pose_sequence.sport} | "
        f"Level: amateur | "
        f"Duration: {duration_s:.1f}s | "
        f"Frames analyzed: {total_frames}"
    )
    output_lines.append("")

    # Summary statistics table
    output_lines.append("JOINT ANGLE SUMMARY (degrees):")
    output_lines.append(f"{'Joint':<20} {'Min':>6} {'Max':>6} {'Mean':>6} {'Std':>6}")
    output_lines.append("-" * 50)

    # Sort joints for consistent ordering
    sorted_joints = sorted(summary_stats.keys())
    for joint_name in sorted_joints:
        stats = summary_stats[joint_name]
        output_lines.append(
            f"{joint_name:<20} "
            f"{stats['min']:>6.1f} "
            f"{stats['max']:>6.1f} "
            f"{stats['mean']:>6.1f} "
            f"{stats['std']:>6.1f}"
        )
    output_lines.append("")

    # Movement phases (divide into thirds)
    output_lines.append("MOVEMENT PHASES:")
    phase_size = max(1, total_frames // 3)

    phases = [
        ("Phase 1 (start)", frames[0:phase_size]),
        ("Phase 2 (mid)", frames[phase_size:2*phase_size]),
        ("Phase 3 (end)", frames[2*phase_size:])
    ]

    for phase_name, phase_frames in phases:
        if not phase_frames:
            continue

        # Compute average angles for this phase
        phase_angles: Dict[str, List[float]] = {}
        for frame in phase_frames:
            for joint_name, angle_value in frame.joint_angles.items():
                if joint_name not in phase_angles:
                    phase_angles[joint_name] = []
                phase_angles[joint_name].append(angle_value)

        # Format phase summary
        frame_range = f"frames {phase_frames[0].frame_index}-{phase_frames[-1].frame_index}"
        angle_strs = []
        for joint_name in sorted_joints[:6]:  # Limit to first 6 joints for brevity
            if joint_name in phase_angles:
                avg_angle = np.mean(phase_angles[joint_name])
                angle_strs.append(f"{joint_name}={avg_angle:.1f}")

        output_lines.append(f"{phase_name} ({frame_range}): {', '.join(angle_strs)}")

    output_lines.append("")

    # Key moments (deviations > 15 degrees from mean)
    output_lines.append("KEY MOMENTS (deviations >15° from mean):")
    key_moments_found = False

    for frame in frames:
        for joint_name, angle_value in frame.joint_angles.items():
            if joint_name in summary_stats:
                mean_angle = summary_stats[joint_name]["mean"]
                deviation = abs(angle_value - mean_angle)

                if deviation > 15.0:
                    key_moments_found = True
                    severity = "CRITICAL" if deviation > 30 else "WARNING"
                    timestamp_s = frame.timestamp_ms / 1000
                    output_lines.append(
                        f"Frame {frame.frame_index} [{timestamp_s:.2f}s]: "
                        f"{joint_name}={angle_value:.1f}° "
                        f"({severity}: {deviation:.1f}° from mean)"
                    )

    if not key_moments_found:
        output_lines.append("No significant deviations detected (movement is consistent).")

    output_lines.append("")

    # Timeline sample (every 10th frame, or fewer if not enough frames)
    output_lines.append("TIMELINE SAMPLE:")
    sample_interval = max(1, total_frames // 10)  # Show ~10 frames
    sample_frames = frames[::sample_interval][:10]  # Cap at 10 samples

    # Build header for timeline table
    header_joints = sorted_joints[:7]  # Show first 7 joints
    header = f"{'Frame':<6} {'Time':<8}"
    for joint in header_joints:
        # Abbreviate joint names for table width
        abbrev = joint.replace("_", "-")[:8]
        header += f" {abbrev:>8}"
    output_lines.append(header)

    # Add sample rows
    for frame in sample_frames:
        timestamp_s = frame.timestamp_ms / 1000
        row = f"{frame.frame_index:<6} {timestamp_s:<8.2f}"
        for joint in header_joints:
            angle = frame.joint_angles.get(joint, 0.0)
            row += f" {angle:>8.1f}"
        output_lines.append(row)

    output_lines.append("")
    output_lines.append("=== END ANALYSIS ===")

    return "\n".join(output_lines)


def compute_summary_stats(frames: List[FramePose]) -> Dict[str, Any]:
    """
    Compute summary statistics across all frames for storage in PoseSequence.

    Args:
        frames: List of FramePose objects

    Returns:
        Dictionary with min/max/mean/std for each joint angle
    """
    joint_data: Dict[str, List[float]] = {}

    for frame in frames:
        for joint_name, angle_value in frame.joint_angles.items():
            if joint_name not in joint_data:
                joint_data[joint_name] = []
            joint_data[joint_name].append(angle_value)

    summary_stats = {}
    for joint_name, angles in joint_data.items():
        if angles:
            summary_stats[joint_name] = {
                "min": float(np.min(angles)),
                "max": float(np.max(angles)),
                "mean": float(np.mean(angles)),
                "std": float(np.std(angles))
            }

    return summary_stats
