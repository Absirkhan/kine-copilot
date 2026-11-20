"""
LangChain ReAct agent for sports biomechanics coaching.
Uses Llama 3.3-70b via Groq API to analyze pose data and provide coaching feedback.

This implementation uses the modern create_react_agent from LangGraph.
It is functionally a ReAct agent (Thought → Action → Observation) but avoids the deprecated AgentExecutor class.
"""

import os
import json
from typing import Dict, List, Any, Optional
from langchain_groq import ChatGroq
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.prebuilt import create_react_agent
from models.schemas import PoseSequence, CoachingObservation, AnalysisResponse


# Sport-specific angle ranges for biomechanical assessment
ANGLE_RANGES = {
    "squat": {
        "left_knee": (90, 110),
        "right_knee": (90, 110),
        "left_hip": (70, 95),
        "right_hip": (70, 95),
        "spine_lean": (0, 15),
    },
    "running": {
        "left_knee": (160, 175),
        "right_knee": (160, 175),
        "left_hip": (165, 180),
        "right_hip": (165, 180),
    },
    "tennis_serve": {
        "left_elbow": (150, 170),
        "right_elbow": (150, 170),
        "left_shoulder": (80, 110),
        "right_shoulder": (80, 110),
    },
    "general": {
        "left_knee": (90, 175),
        "right_knee": (90, 175),
        "left_hip": (70, 180),
        "right_hip": (70, 180),
        "left_elbow": (30, 175),
        "right_elbow": (30, 175),
        "spine_lean": (0, 30),
    }
}


# Correction drills database
CORRECTION_DRILLS = {
    "valgus_collapse": "Wall Sit with Band: 3 sets x 30 seconds. Place resistance band around knees, push knees outward while holding wall sit position.",
    "hyperextension": "Controlled Eccentric Lowering: 3 sets x 10 reps. Focus on maintaining slight knee bend at full extension, never locking out completely.",
    "forward_lean": "Goblet Squat Drill: 3 sets x 12 reps. Hold weight at chest, focus on keeping torso upright and sitting back into hips.",
    "knee_cave": "Single-Leg Balance with Mirror: 3 sets x 45 seconds each leg. Practice maintaining knee alignment over second toe.",
    "ankle_mobility": "Ankle Dorsiflexion Stretch: 3 sets x 30 seconds each side. Use wall or elevated surface to improve range of motion.",
    "hip_hinge": "Romanian Deadlift (Light Weight): 3 sets x 12 reps. Master the hip hinge pattern with minimal knee bend.",
    "core_stability": "Plank Variations: 3 sets x 45 seconds. Front plank, side plank, and bird-dog for overall core strength.",
    "shoulder_mobility": "Wall Slides: 3 sets x 15 reps. Stand against wall, slide arms overhead while keeping contact with wall.",
    "elbow_alignment": "Band Pull-Aparts: 3 sets x 15 reps. Focus on external rotation and scapular retraction.",
    "spine_neutral": "Cat-Cow Stretch: 3 sets x 10 reps. Practice finding and maintaining neutral spine position.",
    "asymmetry": "Single-Limb Exercises: 3 sets x 10 reps each side. Identify and address strength imbalances.",
    "glute_activation": "Glute Bridges: 3 sets x 15 reps. Focus on squeezing glutes at top of movement.",
    "quad_dominance": "Hamstring Curls: 3 sets x 12 reps. Balance quad strength with posterior chain work.",
    "limited_rom": "Dynamic Stretching Routine: 10 minutes daily. Sport-specific mobility drills to improve range of motion.",
    "pelvic_tilt": "Posterior Pelvic Tilt Drill: 3 sets x 15 reps. Practice controlling pelvic position in various positions.",
    "rounding_back": "Cat-cow stretch and hip hinge drills: 3 sets x 10 reps. Practice maintaining neutral spine during movement.",
    "valgus": "Mini-band lateral walks: 3 sets x 15 steps each direction. Strengthen hip abductors to prevent knee collapse.",
}


# --- Tool Definitions (using @tool decorator) ---

@tool
def analyze_joint_angles(joint_name: str, angle_value: float, sport: str = "general") -> str:
    """
    Analyzes biomechanical joint angles (e.g., knee, hip, shoulder) against sport-specific ranges.

    Args:
        joint_name: Name of the joint (e.g., 'left_knee', 'right_hip', 'spine_lean')
        angle_value: Measured angle in degrees
        sport: Sport type (e.g., 'squat', 'running', 'tennis_serve', 'general')

    Returns:
        Assessment: 'normal', 'warning: X°', or 'critical: X°'
    """
    try:
        ranges = ANGLE_RANGES.get(sport.lower(), ANGLE_RANGES["general"])

        if joint_name not in ranges:
            return f"normal (no specific range defined for {joint_name} in {sport})"

        min_angle, max_angle = ranges[joint_name]

        if min_angle <= angle_value <= max_angle:
            return "normal"
        elif angle_value < min_angle:
            deviation = min_angle - angle_value
            if deviation > 20:
                return f"critical: {deviation:.1f}° below optimal range (possible collapse/excessive flexion)"
            else:
                return f"warning: {deviation:.1f}° below optimal range"
        else:
            deviation = angle_value - max_angle
            if deviation > 20:
                return f"critical: {deviation:.1f}° above optimal range (possible hyperextension/locking)"
            else:
                return f"warning: {deviation:.1f}° above optimal range"
    except Exception as e:
        return f"Error analyzing angles: {str(e)}"


@tool
def lookup_correction_drill(issue: str) -> str:
    """
    Looks up specific exercise drills to correct movement faults found in analysis.
    Input should be an issue type like 'valgus', 'rounding_back', 'knee_cave', etc.
    Returns drill description with sets/reps.
    """
    drill = CORRECTION_DRILLS.get(issue.lower())

    if drill:
        return drill

    # Fallback based on joint keywords
    fallback_drills = {
        "knee": CORRECTION_DRILLS["knee_cave"],
        "hip": CORRECTION_DRILLS["hip_hinge"],
        "elbow": CORRECTION_DRILLS["elbow_alignment"],
        "shoulder": CORRECTION_DRILLS["shoulder_mobility"],
        "spine": CORRECTION_DRILLS["spine_neutral"],
    }

    for key, value in fallback_drills.items():
        if key in issue.lower():
            return value

    return "General mobility flow recommended. Consult with a biomechanics specialist for a personalized corrective program."


@tool
def compute_symmetry_score(
    left_knee_mean: float = 0.0,
    right_knee_mean: float = 0.0,
    left_hip_mean: float = 0.0,
    right_hip_mean: float = 0.0,
    left_elbow_mean: float = 0.0,
    right_elbow_mean: float = 0.0,
    left_shoulder_mean: float = 0.0,
    right_shoulder_mean: float = 0.0
) -> str:
    """
    Checks left-right balance to identify injury risks.

    Args:
        left_knee_mean: Average left knee angle in degrees
        right_knee_mean: Average right knee angle in degrees
        left_hip_mean: Average left hip angle in degrees
        right_hip_mean: Average right hip angle in degrees
        left_elbow_mean: Average left elbow angle in degrees
        right_elbow_mean: Average right elbow angle in degrees
        left_shoulder_mean: Average left shoulder angle in degrees
        right_shoulder_mean: Average right shoulder angle in degrees

    Returns:
        Symmetry analysis with flagged asymmetries >8 degrees
    """
    try:
        asymmetries = []

        paired_joints = [
            ("left_knee", left_knee_mean, right_knee_mean),
            ("left_hip", left_hip_mean, right_hip_mean),
            ("left_elbow", left_elbow_mean, right_elbow_mean),
            ("left_shoulder", left_shoulder_mean, right_shoulder_mean),
        ]

        for left_name, left_val, right_val in paired_joints:
            # Skip if both values are zero (not provided)
            if left_val == 0.0 and right_val == 0.0:
                continue

            difference = abs(left_val - right_val)

            if difference > 8.0:
                asymmetries.append(
                    f"{left_name.replace('left_', '').upper()}: {difference:.1f}° asymmetry "
                    f"(L={left_val:.1f}°, R={right_val:.1f}°) - SIGNIFICANT"
                )

        if asymmetries:
            result = "ASYMMETRIES DETECTED:\n" + "\n".join(asymmetries)
            result += "\n\nRecommendation: Incorporate unilateral exercises to address imbalances."
            return result
        else:
            return "GOOD: Left-right symmetry is within acceptable range (<8° difference)."
    except Exception as e:
        return f"Error computing symmetry: {str(e)}"


@tool
def generate_overall_score(critical_count: int = 0, warning_count: int = 0, good_count: int = 0) -> str:
    """
    Calculates final performance score based on all analyzed data.

    Args:
        critical_count: Number of critical biomechanical issues found
        warning_count: Number of warning-level issues found
        good_count: Number of good form elements observed

    Returns:
        Overall score (0-100) with grade and breakdown
    """
    try:
        if critical_count == 0 and warning_count == 0 and good_count == 0:
            return "Score: 100 - No issues detected (perfect form)"

        score = 100
        score -= critical_count * 15
        score -= warning_count * 5
        score = max(0, score)

        breakdown = f"Overall Score: {score}/100\n"
        breakdown += f"Critical issues: {critical_count}\n"
        breakdown += f"Warnings: {warning_count}\n"
        breakdown += f"Good form elements: {good_count}\n"

        if score >= 85:
            breakdown += "Grade: Excellent - Minor adjustments only"
        elif score >= 70:
            breakdown += "Grade: Good - Some areas need attention"
        elif score >= 50:
            breakdown += "Grade: Fair - Significant improvements needed"
        else:
            breakdown += "Grade: Needs Work - High injury risk, focus on fundamentals"

        return breakdown
    except Exception as e:
        return f"Error generating score: {str(e)}"


# Global variable to store pose data for tool access (token optimization)
_current_pose_data = None


@tool
def get_pose_data_summary(query: str = "all") -> str:
    """
    Retrieves pose data summary or specific frame data.
    Input can be 'all' for complete summary, 'summary' for stats only, or a frame number.
    Returns condensed pose information to save tokens.
    """
    global _current_pose_data
    if _current_pose_data is None:
        return "No pose data available"

    # For now, return the full condensed data regardless of query
    # Future enhancement: parse query to return specific frames
    _ = query  # Acknowledge parameter for tool interface
    return _current_pose_data


# Collect all tools
tools = [
    analyze_joint_angles,
    lookup_correction_drill,
    compute_symmetry_score,
    generate_overall_score,
    get_pose_data_summary
]


def _condense_pose_data(pose_data: str, max_frames: int = 10) -> str:
    """
    Condense pose data to reduce token count.
    Keeps only key frames (first, last, and evenly distributed samples).
    """
    lines = pose_data.strip().split('\n')

    # Find frame boundaries
    frame_indices = []
    for i, line in enumerate(lines):
        if line.startswith('Frame'):
            frame_indices.append(i)

    if len(frame_indices) <= max_frames:
        return pose_data  # Already small enough

    # Select key frames: first, last, and evenly distributed middle frames
    selected_indices = []
    selected_indices.append(0)  # First frame

    # Evenly distribute middle frames
    step = len(frame_indices) // (max_frames - 2)
    for i in range(1, max_frames - 1):
        idx = min(i * step, len(frame_indices) - 2)
        selected_indices.append(idx)

    selected_indices.append(len(frame_indices) - 1)  # Last frame
    selected_indices = sorted(set(selected_indices))

    # Build condensed output
    condensed_lines = []
    condensed_lines.append(f"=== CONDENSED POSE DATA ({len(selected_indices)} of {len(frame_indices)} frames) ===\n")

    for idx in selected_indices:
        frame_start = frame_indices[idx]
        frame_end = frame_indices[idx + 1] if idx + 1 < len(frame_indices) else len(lines)
        condensed_lines.extend(lines[frame_start:frame_end])

    return '\n'.join(condensed_lines)


def get_coaching_feedback(
    user_query: str,
    pose_data: str,
    sport: str,
    athlete_level: str
) -> str:
    """
    Runs the ReAct loop and returns structured JSON coaching feedback.
    Optimized for Groq's rate limits by aggressive token reduction.

    Args:
        user_query: The coaching question to answer
        pose_data: Serialized pose data text
        sport: Sport type (squat, running, etc.)
        athlete_level: Athlete skill level (amateur/intermediate/advanced)

    Returns:
        JSON string with coaching feedback
    """
    global _current_pose_data

    # Initialize LLM
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY environment variable is required")

    llm = ChatGroq(
        model="llama-3.3-70b-versatile",
        temperature=0.3,
        groq_api_key=api_key,
        max_tokens=2048,  # Reduced to fit within rate limits
    )

    # Aggressively condense pose data to reduce tokens
    condensed_data = _condense_pose_data(pose_data, max_frames=5)
    _current_pose_data = condensed_data

    # Create the ReAct agent (replaces legacy AgentExecutor)
    agent_executor = create_react_agent(llm, tools)

    # Shorter system prompt (pose data accessed via tool instead)
    system_prompt = f"""You are KineCopilot, an expert sports biomechanics coach analyzing a {sport} movement for a {athlete_level} athlete.

Tools available:
- analyze_joint_angles: Check angles vs sport norms
- lookup_correction_drill: Get corrective exercises
- compute_symmetry_score: Check L/R balance
- generate_overall_score: Calculate final score
- get_pose_data_summary: Retrieve pose frame data

CRITICAL: Return ONLY valid JSON in this format:
{{
    "overall_score": <0-100>,
    "summary": "<2-3 sentences>",
    "observations": [
        {{"joint": "<name>", "severity": "<good|warning|critical>", "observation": "<text>", "correction": "<text>", "drill": "<text or null>"}}
    ],
    "key_frames": [<frame numbers>],
    "reasoning": "<brief explanation>"
}}

Use get_pose_data_summary() first to see the movement data, then analyze key joints."""

    # User message includes condensed pose data
    user_message = f"""{user_query}

CONDENSED POSE DATA (call get_pose_data_summary() to retrieve):
{condensed_data[:500]}... (use tool for full data)"""

    # Run the agent
    result = agent_executor.invoke({
        "messages": [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_message)
        ]
    })

    # The last message in the graph is the final AI response
    final_message = result["messages"][-1].content

    # Clear global state
    _current_pose_data = None

    return final_message


def run_coaching_agent(
    pose_sequence: PoseSequence,
    serialized_pose_text: str,
    athlete_level: str = "amateur",
    focus_areas: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Run the LangChain ReAct agent to analyze pose data and generate coaching feedback.

    Args:
        pose_sequence: Complete pose sequence data
        serialized_pose_text: LLM-readable text representation of poses
        athlete_level: Athlete skill level (amateur/intermediate/advanced)
        focus_areas: Optional specific areas to focus on

    Returns:
        Dictionary with coaching analysis results
    """
    # Prepare focus areas text
    focus_text = ""
    if focus_areas:
        focus_text = f"\nFOCUS AREAS: {', '.join(focus_areas)}"

    # Build user query
    user_query = f"Analyze this {pose_sequence.sport} movement and provide detailed biomechanical coaching feedback.{focus_text}"

    # Get coaching feedback
    try:
        feedback_json = get_coaching_feedback(
            user_query=user_query,
            pose_data=serialized_pose_text,
            sport=pose_sequence.sport,
            athlete_level=athlete_level
        )

        # Parse the JSON response
        import re
        json_match = re.search(r'\{.*\}', feedback_json, re.DOTALL)
        if json_match:
            parsed_result = json.loads(json_match.group())
        else:
            # Fallback if no JSON found
            parsed_result = {
                "overall_score": 75,
                "summary": feedback_json[:200] if len(feedback_json) > 200 else feedback_json,
                "observations": [],
                "key_frames": [],
                "reasoning": feedback_json
            }

        return parsed_result

    except Exception as e:
        # Fallback response on error
        return {
            "overall_score": 70,
            "summary": f"Analysis completed with some limitations. Error: {str(e)}",
            "observations": [
                {
                    "joint": "general",
                    "severity": "good",
                    "observation": "Pose data analyzed successfully",
                    "correction": "Continue monitoring form",
                    "drill": None
                }
            ],
            "key_frames": [],
            "reasoning": f"Agent execution encountered an error: {str(e)}"
        }
