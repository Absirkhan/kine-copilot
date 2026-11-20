"""Video processing utilities using OpenCV."""

import os
import cv2
import shutil
import uuid
from typing import List, Dict, Any, Tuple
from pathlib import Path
import numpy as np
from fastapi import UploadFile


def process_video(
    video_file: UploadFile,
    max_duration_seconds: int = 60,
    sample_rate: int = 3
) -> Tuple[List[np.ndarray], Dict[str, Any], str]:
    """
    Process an uploaded video file and extract frames.

    Args:
        video_file: FastAPI UploadFile object
        max_duration_seconds: Maximum allowed video duration
        sample_rate: Extract every Nth frame

    Returns:
        Tuple of (frames_list, metadata_dict, temp_dir_path)
        - frames_list: List of numpy arrays (BGR format)
        - metadata_dict: Video metadata (fps, total_frames, duration_ms, etc.)
        - temp_dir_path: Path to temporary directory (caller should clean up)

    Raises:
        ValueError: If video is too long or cannot be read
    """
    # Create temporary directory for this session
    session_id = str(uuid.uuid4())
    temp_dir = Path(f"/tmp/kinecopilot_{session_id}")
    temp_dir.mkdir(parents=True, exist_ok=True)

    # Save uploaded file to temp directory
    video_path = temp_dir / video_file.filename
    try:
        with open(video_path, "wb") as buffer:
            shutil.copyfileobj(video_file.file, buffer)
    except Exception as e:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise ValueError(f"Failed to save video file: {str(e)}")

    # Open video with OpenCV
    cap = cv2.VideoCapture(str(video_path))

    if not cap.isOpened():
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise ValueError("Failed to open video file. Ensure it's a valid video format.")

    # Get video metadata
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    if fps <= 0:
        fps = 30.0  # Default fallback

    duration_ms = (total_frames / fps) * 1000
    duration_seconds = duration_ms / 1000

    # Check duration limit
    if duration_seconds > max_duration_seconds:
        cap.release()
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise ValueError(
            f"Video duration ({duration_seconds:.1f}s) exceeds maximum allowed "
            f"({max_duration_seconds}s)"
        )

    # Extract frames
    frames = []
    frame_indices = []
    frame_count = 0

    while True:
        ret, frame = cap.read()

        if not ret:
            break

        # Sample every Nth frame
        if frame_count % sample_rate == 0:
            frames.append(frame)
            frame_indices.append(frame_count)

        frame_count += 1

    cap.release()

    if not frames:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise ValueError("No frames could be extracted from the video")

    # Build metadata
    metadata = {
        "fps": fps,
        "total_frames": total_frames,
        "extracted_frames": len(frames),
        "duration_ms": duration_ms,
        "duration_seconds": duration_seconds,
        "width": width,
        "height": height,
        "sample_rate": sample_rate,
        "frame_indices": frame_indices,
        "session_id": session_id,
    }

    return frames, metadata, str(temp_dir)


def cleanup_temp_directory(temp_dir: str) -> None:
    """
    Clean up temporary directory and all its contents.

    Args:
        temp_dir: Path to temporary directory to remove
    """
    try:
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
    except Exception as e:
        # Log but don't raise - cleanup failures shouldn't break the app
        print(f"Warning: Failed to clean up temp directory {temp_dir}: {str(e)}")


def save_frame_as_image(frame: np.ndarray, output_path: str) -> None:
    """
    Save a single frame as an image file.

    Args:
        frame: Frame as numpy array (BGR format)
        output_path: Path where image should be saved
    """
    cv2.imwrite(output_path, frame)
