from typing import Dict, List, Optional, Any
from pydantic import BaseModel


class KeyPoint(BaseModel):
    """Represents a single skeletal keypoint with normalized coordinates."""
    name: str           # e.g. "LEFT_KNEE"
    x: float            # normalized 0-1
    y: float            # normalized 0-1
    visibility: float   # 0-1


class FramePose(BaseModel):
    """Pose data for a single frame."""
    frame_index: int
    timestamp_ms: float
    keypoints: List[KeyPoint]
    joint_angles: Dict[str, float]  # e.g. {"left_knee": 145.2, "right_hip": 87.3}


class PoseSequence(BaseModel):
    """Complete pose sequence for a video/activity."""
    sport: str                      # e.g. "squat", "tennis_serve", "running"
    fps: float
    total_frames: int
    frames: List[FramePose]
    summary_stats: Dict[str, Any]   # min/max/mean per joint angle


class AnalysisRequest(BaseModel):
    """Request payload for pose analysis."""
    pose_sequence: Optional[PoseSequence] = None
    sport: str = "general"
    athlete_level: str = "amateur"  # amateur | intermediate | advanced
    focus_areas: List[str] = []     # e.g. ["knee_alignment", "spine_position"]


class CoachingObservation(BaseModel):
    """Single biomechanical observation with correction."""
    joint: str
    severity: str                   # "good" | "warning" | "critical"
    observation: str
    correction: str
    drill: Optional[str] = None


class AnalysisResponse(BaseModel):
    """Complete coaching analysis result."""
    session_id: str
    sport: str
    overall_score: int              # 0-100
    summary: str
    observations: List[CoachingObservation]
    key_frames: List[int]           # frame indices that show the issue most clearly
    agent_reasoning: str            # the agent's chain of thought (for debugging/display)
    processing_time_ms: float
