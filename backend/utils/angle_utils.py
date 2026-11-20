"""Pure mathematical functions for computing joint angles from 2D keypoints."""

import numpy as np
from typing import Dict, Tuple, List


def compute_joint_angle(a: Tuple[float, float], b: Tuple[float, float], c: Tuple[float, float]) -> float:
    """
    Compute the angle at point b formed by points a-b-c using dot product method.

    Args:
        a: First point (x, y)
        b: Vertex point (x, y)
        c: Third point (x, y)

    Returns:
        Angle in degrees (0-180)
    """
    # Convert to numpy arrays
    a = np.array(a)
    b = np.array(b)
    c = np.array(c)

    # Create vectors
    ba = a - b
    bc = c - b

    # Calculate angle using dot product
    cos_angle = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-8)

    # Clamp to avoid numerical errors
    cos_angle = np.clip(cos_angle, -1.0, 1.0)

    # Return angle in degrees
    angle = np.arccos(cos_angle)
    return np.degrees(angle)


def compute_joint_angles(keypoints: Dict[str, Tuple[float, float]]) -> Dict[str, float]:
    """
    Compute all relevant joint angles from a dictionary of keypoints.

    Args:
        keypoints: Dictionary mapping landmark names to (x, y) coordinates

    Returns:
        Dictionary of joint angles in degrees
    """
    angles = {}

    # Helper function to safely compute angle
    def safe_angle(joint_name: str, p1_name: str, p2_name: str, p3_name: str):
        try:
            if all(name in keypoints for name in [p1_name, p2_name, p3_name]):
                return compute_joint_angle(
                    keypoints[p1_name],
                    keypoints[p2_name],
                    keypoints[p3_name]
                )
        except Exception:
            pass
        return None

    # Left knee: LEFT_HIP → LEFT_KNEE → LEFT_ANKLE
    angle = safe_angle("left_knee", "LEFT_HIP", "LEFT_KNEE", "LEFT_ANKLE")
    if angle is not None:
        angles["left_knee"] = angle

    # Right knee: RIGHT_HIP → RIGHT_KNEE → RIGHT_ANKLE
    angle = safe_angle("right_knee", "RIGHT_HIP", "RIGHT_KNEE", "RIGHT_ANKLE")
    if angle is not None:
        angles["right_knee"] = angle

    # Left hip: LEFT_SHOULDER → LEFT_HIP → LEFT_KNEE
    angle = safe_angle("left_hip", "LEFT_SHOULDER", "LEFT_HIP", "LEFT_KNEE")
    if angle is not None:
        angles["left_hip"] = angle

    # Right hip: RIGHT_SHOULDER → RIGHT_HIP → RIGHT_KNEE
    angle = safe_angle("right_hip", "RIGHT_SHOULDER", "RIGHT_HIP", "RIGHT_KNEE")
    if angle is not None:
        angles["right_hip"] = angle

    # Left elbow: LEFT_SHOULDER → LEFT_ELBOW → LEFT_WRIST
    angle = safe_angle("left_elbow", "LEFT_SHOULDER", "LEFT_ELBOW", "LEFT_WRIST")
    if angle is not None:
        angles["left_elbow"] = angle

    # Right elbow: RIGHT_SHOULDER → RIGHT_ELBOW → RIGHT_WRIST
    angle = safe_angle("right_elbow", "RIGHT_SHOULDER", "RIGHT_ELBOW", "RIGHT_WRIST")
    if angle is not None:
        angles["right_elbow"] = angle

    # Left shoulder: LEFT_ELBOW → LEFT_SHOULDER → LEFT_HIP
    angle = safe_angle("left_shoulder", "LEFT_ELBOW", "LEFT_SHOULDER", "LEFT_HIP")
    if angle is not None:
        angles["left_shoulder"] = angle

    # Right shoulder: RIGHT_ELBOW → RIGHT_SHOULDER → RIGHT_HIP
    angle = safe_angle("right_shoulder", "RIGHT_ELBOW", "RIGHT_SHOULDER", "RIGHT_HIP")
    if angle is not None:
        angles["right_shoulder"] = angle

    # Spine lean: midpoint(shoulders) → midpoint(hips) projected angle from vertical
    try:
        if all(name in keypoints for name in ["LEFT_SHOULDER", "RIGHT_SHOULDER", "LEFT_HIP", "RIGHT_HIP"]):
            left_shoulder = np.array(keypoints["LEFT_SHOULDER"])
            right_shoulder = np.array(keypoints["RIGHT_SHOULDER"])
            left_hip = np.array(keypoints["LEFT_HIP"])
            right_hip = np.array(keypoints["RIGHT_HIP"])

            mid_shoulder = (left_shoulder + right_shoulder) / 2
            mid_hip = (left_hip + right_hip) / 2

            # Vector from hips to shoulders
            spine_vector = mid_shoulder - mid_hip

            # Vertical vector (pointing up in image coordinates, which is negative y)
            vertical_vector = np.array([0, -1])

            # Compute angle from vertical
            cos_angle = np.dot(spine_vector, vertical_vector) / (np.linalg.norm(spine_vector) + 1e-8)
            cos_angle = np.clip(cos_angle, -1.0, 1.0)
            spine_angle = np.degrees(np.arccos(cos_angle))

            angles["spine_lean"] = spine_angle
    except Exception:
        pass

    return angles
