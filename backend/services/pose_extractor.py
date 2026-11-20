"""Pose extraction using MediaPipe Vision Tasks API. Processes video frames to extract skeletal keypoints."""

import mediapipe as mp
import numpy as np
from typing import List, Dict, Tuple
from pathlib import Path
import urllib.request
import os
from models.schemas import FramePose, KeyPoint
from utils.angle_utils import compute_joint_angles


# MediaPipe landmark name mapping
LANDMARK_NAMES = {
    0: "NOSE",
    1: "LEFT_EYE_INNER",
    2: "LEFT_EYE",
    3: "LEFT_EYE_OUTER",
    4: "RIGHT_EYE_INNER",
    5: "RIGHT_EYE",
    6: "RIGHT_EYE_OUTER",
    7: "LEFT_EAR",
    8: "RIGHT_EAR",
    9: "MOUTH_LEFT",
    10: "MOUTH_RIGHT",
    11: "LEFT_SHOULDER",
    12: "RIGHT_SHOULDER",
    13: "LEFT_ELBOW",
    14: "RIGHT_ELBOW",
    15: "LEFT_WRIST",
    16: "RIGHT_WRIST",
    17: "LEFT_PINKY",
    18: "RIGHT_PINKY",
    19: "LEFT_INDEX",
    20: "RIGHT_INDEX",
    21: "LEFT_THUMB",
    22: "RIGHT_THUMB",
    23: "LEFT_HIP",
    24: "RIGHT_HIP",
    25: "LEFT_KNEE",
    26: "RIGHT_KNEE",
    27: "LEFT_ANKLE",
    28: "RIGHT_ANKLE",
    29: "LEFT_HEEL",
    30: "RIGHT_HEEL",
    31: "LEFT_FOOT_INDEX",
    32: "RIGHT_FOOT_INDEX",
}


# Download pose landmarker model if not exists
MODEL_PATH = Path(__file__).parent.parent / "models" / "pose_landmarker.task"
MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task"

def ensure_model_downloaded():
    """Download the MediaPipe pose landmarker model if not present."""
    MODEL_PATH.parent.mkdir(exist_ok=True)

    if not MODEL_PATH.exists():
        print(f"Downloading pose landmarker model to {MODEL_PATH}...")
        urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
        print("Model downloaded successfully!")


def extract_poses_from_frames(
    frames: List[np.ndarray],
    fps: float,
    sample_rate: int = 1
) -> List[FramePose]:
    """
    Extract pose keypoints from a list of video frames using MediaPipe Vision Tasks API.

    Args:
        frames: List of video frames as numpy arrays (BGR format)
        fps: Frames per second of the source video
        sample_rate: Process every Nth frame (default: 1 for all frames)

    Returns:
        List of FramePose objects containing keypoints and joint angles
    """
    # Ensure model is downloaded
    ensure_model_downloaded()

    # Import MediaPipe Vision Tasks
    from mediapipe.tasks import python
    from mediapipe.tasks.python import vision

    pose_frames = []

    # Create PoseLandmarker
    base_options = python.BaseOptions(model_asset_path=str(MODEL_PATH))
    options = vision.PoseLandmarkerOptions(
        base_options=base_options,
        running_mode=vision.RunningMode.VIDEO,  # Use VIDEO mode for better tracking
        min_pose_detection_confidence=0.5,
        min_tracking_confidence=0.5
    )

    with vision.PoseLandmarker.create_from_options(options) as landmarker:
        for frame_idx, frame in enumerate(frames):
            # Skip frames based on sample_rate
            if frame_idx % sample_rate != 0:
                continue

            # Convert BGR to RGB
            rgb_frame = frame[:, :, ::-1].copy()

            # Create MediaPipe Image
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)

            # Calculate timestamp in milliseconds
            timestamp_ms = int((frame_idx / fps) * 1000)

            # Process the frame
            detection_result = landmarker.detect_for_video(mp_image, timestamp_ms)

            if detection_result.pose_landmarks:
                # Extract keypoints from first detected pose
                landmarks = detection_result.pose_landmarks[0]

                keypoints_list = []
                keypoints_dict = {}

                for idx, landmark in enumerate(landmarks):
                    landmark_name = LANDMARK_NAMES.get(idx, f"LANDMARK_{idx}")

                    keypoint = KeyPoint(
                        name=landmark_name,
                        x=landmark.x,
                        y=landmark.y,
                        visibility=landmark.visibility
                    )
                    keypoints_list.append(keypoint)

                    # Store in dict for angle computation
                    keypoints_dict[landmark_name] = (landmark.x, landmark.y)

                # Compute joint angles
                joint_angles = compute_joint_angles(keypoints_dict)

                # Create FramePose
                frame_pose = FramePose(
                    frame_index=frame_idx,
                    timestamp_ms=float(timestamp_ms),
                    keypoints=keypoints_list,
                    joint_angles=joint_angles
                )
                pose_frames.append(frame_pose)

    return pose_frames
