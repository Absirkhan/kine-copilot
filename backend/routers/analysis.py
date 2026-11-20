"""Analysis router - handles pose analysis requests."""

import os
import json
import time
import uuid
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse

from models.schemas import PoseSequence, AnalysisResponse, CoachingObservation
from services.video_processor import process_video, cleanup_temp_directory
from services.pose_extractor import extract_poses_from_frames
from services.pose_serializer import serialize_for_llm, compute_summary_stats
from services.coaching_agent import run_coaching_agent


router = APIRouter(prefix="/analyze", tags=["analysis"])


# In-memory session cache (for MVP - replace with Redis/DB in production)
session_cache = {}


@router.post("", response_model=AnalysisResponse)
async def analyze_pose(
    video: Optional[UploadFile] = File(None),
    pose_json: Optional[str] = Form(None),
    sport: str = Form("general"),
    athlete_level: str = Form("amateur"),
    focus_areas: Optional[str] = Form(None)
):
    """
    Analyze athletic movement from video or pre-computed pose JSON.

    Args:
        video: Optional video file upload
        pose_json: Optional pre-computed pose sequence as JSON string
        sport: Sport type (squat, running, tennis_serve, etc.)
        athlete_level: Athlete skill level (amateur, intermediate, advanced)
        focus_areas: Comma-separated list of focus areas

    Returns:
        AnalysisResponse with coaching feedback
    """
    start_time = time.time()
    session_id = str(uuid.uuid4())
    temp_dir = None

    try:
        # Validate input
        if not video and not pose_json:
            raise HTTPException(
                status_code=400,
                detail="Either 'video' or 'pose_json' must be provided"
            )

        if video and pose_json:
            raise HTTPException(
                status_code=400,
                detail="Provide either 'video' or 'pose_json', not both"
            )

        # Parse focus areas
        focus_areas_list = []
        if focus_areas:
            focus_areas_list = [area.strip() for area in focus_areas.split(",")]

        # Get environment variables
        max_duration = int(os.getenv("MAX_VIDEO_DURATION_SECONDS", "60"))
        sample_rate = int(os.getenv("FRAME_SAMPLE_RATE", "3"))

        pose_sequence = None

        # Path 1: Video upload - full pipeline
        if video:
            # Process video
            frames, metadata, temp_dir = process_video(
                video_file=video,
                max_duration_seconds=max_duration,
                sample_rate=sample_rate
            )

            # Extract poses from frames
            pose_frames = extract_poses_from_frames(
                frames=frames,
                fps=metadata["fps"],
                sample_rate=1  # Already sampled in video_processor
            )

            if not pose_frames:
                raise HTTPException(
                    status_code=422,
                    detail="No valid poses could be extracted from the video"
                )

            # Compute summary stats
            summary_stats = compute_summary_stats(pose_frames)

            # Create PoseSequence
            pose_sequence = PoseSequence(
                sport=sport,
                fps=metadata["fps"],
                total_frames=len(pose_frames),
                frames=pose_frames,
                summary_stats=summary_stats
            )

        # Path 2: Pre-computed pose JSON
        elif pose_json:
            try:
                pose_data = json.loads(pose_json)
                pose_sequence = PoseSequence(**pose_data)
            except json.JSONDecodeError as e:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid JSON in pose_json: {str(e)}"
                )
            except Exception as e:
                raise HTTPException(
                    status_code=422,
                    detail=f"Invalid pose sequence data: {str(e)}"
                )

        # Serialize pose data for LLM
        serialized_text = serialize_for_llm(pose_sequence)

        # Debug output if enabled
        if os.getenv("KINECOPILOT_DEBUG") == "true":
            print("\n=== SERIALIZED POSE DATA FOR LLM ===")
            print(serialized_text)
            print("=" * 50)

        # Run coaching agent
        agent_result = run_coaching_agent(
            pose_sequence=pose_sequence,
            serialized_pose_text=serialized_text,
            athlete_level=athlete_level,
            focus_areas=focus_areas_list if focus_areas_list else None
        )

        # Build observations from agent result
        observations = []
        for obs_data in agent_result.get("observations", []):
            observation = CoachingObservation(
                joint=obs_data.get("joint", "unknown"),
                severity=obs_data.get("severity", "good"),
                observation=obs_data.get("observation", ""),
                correction=obs_data.get("correction", ""),
                drill=obs_data.get("drill")
            )
            observations.append(observation)

        # Calculate processing time
        processing_time_ms = (time.time() - start_time) * 1000

        # Create response
        response = AnalysisResponse(
            session_id=session_id,
            sport=pose_sequence.sport,
            overall_score=agent_result.get("overall_score", 75),
            summary=agent_result.get("summary", "Analysis completed."),
            observations=observations,
            key_frames=agent_result.get("key_frames", []),
            agent_reasoning=agent_result.get("reasoning", ""),
            processing_time_ms=processing_time_ms
        )

        # Cache the result
        session_cache[session_id] = response

        return response

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {str(e)}"
        )
    finally:
        # Clean up temp directory
        if temp_dir:
            cleanup_temp_directory(temp_dir)


@router.get("/{session_id}", response_model=AnalysisResponse)
async def get_analysis_result(session_id: str):
    """
    Retrieve a cached analysis result by session ID.

    Args:
        session_id: The session ID from a previous analysis

    Returns:
        AnalysisResponse if found

    Raises:
        HTTPException: 404 if session not found
    """
    if session_id not in session_cache:
        raise HTTPException(
            status_code=404,
            detail=f"Session {session_id} not found or has expired"
        )

    return session_cache[session_id]
