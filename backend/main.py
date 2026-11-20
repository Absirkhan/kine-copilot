"""
KineCopilot FastAPI Application
Main entry point for the API server.
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from routers import analysis_router, health_router


# Load environment variables
load_dotenv()


# Create FastAPI app
app = FastAPI(
    title="KineCopilot API",
    description="AI-powered sports biomechanics coaching platform",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)


# CORS middleware - allow all origins for Next.js dev (restrict in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production: specify your Next.js domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Startup event - validate configuration
@app.on_event("startup")
async def startup_event():
    """Validate required environment variables on startup."""
    groq_key = os.getenv("groq_api_key")

    if not groq_key:
        print("\n" + "="*60)
        print("WARNING: GROQ_API_KEY environment variable not set!")
        print("The coaching agent will not function without this.")
        print("Please set your API key in the .env file.")
        print("="*60 + "\n")
    else:
        print("\n" + "="*60)
        print("KineCopilot API Starting...")
        print(f"Debug mode: {os.getenv('KINECOPILOT_DEBUG', 'false')}")
        print(f"Max video duration: {os.getenv('MAX_VIDEO_DURATION_SECONDS', '60')}s")
        print(f"Frame sample rate: {os.getenv('FRAME_SAMPLE_RATE', '3')}")
        print("Anthropic API: Configured ✓")
        print("="*60 + "\n")


# Include routers
app.include_router(health_router)
app.include_router(analysis_router)


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "service": "KineCopilot API",
        "version": "1.0.0",
        "description": "AI sports biomechanics analyst - extracts pose data from video and provides coaching feedback",
        "docs": "/docs",
        "health": "/health"
    }


if __name__ == "__main__":
    import uvicorn

    # Run with uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
