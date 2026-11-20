"""Health check router."""

import os
from fastapi import APIRouter
from datetime import datetime


router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
async def health_check():
    """
    Health check endpoint for monitoring and load balancers.

    Returns:
        JSON with service status and configuration
    """
    # Check if required API key is configured
    groq_key_configured = bool(os.getenv("GROQ_API_KEY"))

    return {
        "status": "healthy",
        "service": "KineCopilot API",
        "timestamp": datetime.utcnow().isoformat(),
        "configuration": {
            "groq_api_configured": groq_key_configured,
            "debug_mode": os.getenv("KINECOPILOT_DEBUG", "false") == "true",
            "max_video_duration": int(os.getenv("MAX_VIDEO_DURATION_SECONDS", "60")),
            "frame_sample_rate": int(os.getenv("FRAME_SAMPLE_RATE", "3")),
        }
    }
