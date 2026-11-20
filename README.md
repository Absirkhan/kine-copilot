# KineCopilot

AI-powered sports biomechanics analyst that extracts human pose data from video and provides actionable coaching feedback.

## Architecture

```
┌─────────────┐
│ Video/JSON  │
└──────┬──────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│ VIDEO PROCESSOR (video_processor.py)                     │
│ ┌──────────────┐                                         │
│ │ OpenCV       │ Extract frames → Sample every Nth       │
│ └──────────────┘                                         │
└──────┬───────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│ POSE EXTRACTOR (pose_extractor.py)                       │
│ ┌──────────────┐                                         │
│ │ MediaPipe    │ 33 skeletal landmarks per frame         │
│ └──────────────┘                                         │
└──────┬───────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│ ANGLE COMPUTATION (angle_utils.py)                       │
│ 9 joint angles: knee, hip, elbow, shoulder, spine        │
└──────┬───────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│ POSE SERIALIZER (pose_serializer.py) ★ CORE INNOVATION  │
│ Numerical CV output → Structured text for LLM            │
│ • Summary statistics (min/max/mean/std)                  │
│ • Phase analysis (start/mid/end)                         │
│ • Key moments (deviations >15°)                          │
│ • Timeline sample                                        │
└──────┬───────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│ COACHING AGENT (coaching_agent.py)                       │
│ ┌────────────────────────────────────────┐               │
│ │ LangChain ReAct Agent                  │               │
│ │ • Llama 3.3-70b via Groq              │               │
│ │ • 4 tools: analyze_joint_angles,       │               │
│ │   lookup_correction_drill,             │               │
│ │   compute_symmetry_score,              │               │
│ │   generate_overall_score               │               │
│ └────────────────────────────────────────┘               │
└──────┬───────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│ FASTAPI (routers/analysis.py)                            │
│ POST /analyze → AnalysisResponse                         │
└──────┬───────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│ FRONTEND (KineCopilotPanel.tsx)                          │
│ React + Tailwind → Drop into Next.js app                 │
└──────────────────────────────────────────────────────────┘
```

## Quick Start

### Backend Setup

```bash
# 1. Navigate to backend directory
cd backend

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env
# Edit .env and add your GROQ_API_KEY from https://console.groq.com/keys

# 4. Run the server
uvicorn main:app --reload --port 8000
```

The API will be available at:
- Swagger docs: http://localhost:8000/docs
- Health check: http://localhost:8000/health

### Test Without Video

```bash
# Create a sample pose JSON (or use precomputed data from Kaggle notebook)
curl -X POST http://localhost:8000/analyze \
  -F "pose_json=@sample_pose.json" \
  -F "sport=squat" \
  -F "athlete_level=amateur"
```

## Using the Kaggle Notebook for Precomputation

For batch processing of datasets (e.g., Penn Action Dataset):

1. Open `notebooks/kaggle_pose_precompute.ipynb` in Kaggle
2. Add the Penn Action Dataset to your Kaggle notebook
3. Run all cells to:
   - Extract poses from all videos
   - Save as JSON files matching `PoseSequence` schema
   - Download as ZIP
4. Use the JSON files with `POST /analyze` via the `pose_json` parameter

This approach:
- Avoids recomputing poses on every analysis
- Enables fast agent-only experimentation
- Works great for research datasets

## Embedding KineCopilotPanel in Next.js

The frontend is a single self-contained React component designed to drop into any Next.js 14 app.

### Setup

1. Copy `frontend/KineCopilotPanel.tsx` to your Next.js project (e.g., `components/KineCopilotPanel.tsx`)

2. Ensure Tailwind CSS is configured in your Next.js app

3. Set environment variable in `.env.local`:
   ```
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```

4. Use the component in any page:
   ```tsx
   import KineCopilotPanel from '@/components/KineCopilotPanel'

   export default function AnalysisPage() {
     return (
       <div className="min-h-screen bg-[#0f0f0f] p-8">
         <KineCopilotPanel />
       </div>
     )
   }
   ```

The component includes:
- Video/JSON upload
- Real-time analysis progress
- Score visualization (animated SVG circle)
- Observations with severity colors
- Joint angle bar charts (pure CSS)
- Collapsible agent reasoning

## Environment Variables

| Variable | Purpose | Default | Required |
|----------|---------|---------|----------|
| `GROQ_API_KEY` | Groq API key for Llama 3.3-70b coaching agent | - | ✓ Yes |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase admin SDK credentials (JSON) | `{}` | Optional |
| `KINECOPILOT_DEBUG` | Enable verbose logging | `false` | Optional |
| `MAX_VIDEO_DURATION_SECONDS` | Hard limit on video length | `60` | Optional |
| `FRAME_SAMPLE_RATE` | Process every Nth frame | `3` | Optional |

## API Reference

### `POST /analyze`

Analyze athletic movement from video or pre-computed pose JSON.

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`

**Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `video` | File | Conditional | Video file (.mp4, .mov, .avi) |
| `pose_json` | String | Conditional | Pre-computed PoseSequence as JSON |
| `sport` | String | Optional | Sport type (squat, running, tennis_serve, etc.) Default: "general" |
| `athlete_level` | String | Optional | Skill level (amateur, intermediate, advanced) Default: "amateur" |
| `focus_areas` | String | Optional | Comma-separated focus areas (e.g., "knee_alignment,spine_position") |

**Note:** Provide either `video` OR `pose_json`, not both.

**Response:** `AnalysisResponse`
```json
{
  "session_id": "uuid",
  "sport": "squat",
  "overall_score": 82,
  "summary": "Good squat depth with minor knee tracking issue...",
  "observations": [
    {
      "joint": "left_knee",
      "severity": "warning",
      "observation": "Slight valgus collapse at bottom position",
      "correction": "Focus on pushing knees outward throughout movement",
      "drill": "Wall Sit with Band: 3 sets x 30 seconds..."
    }
  ],
  "key_frames": [12, 18, 24],
  "agent_reasoning": "The athlete demonstrates good overall form...",
  "processing_time_ms": 2847.3
}
```

### `GET /analyze/{session_id}`

Retrieve cached analysis result.

**Response:** Same as `POST /analyze`

### `GET /health`

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "service": "KineCopilot API",
  "timestamp": "2025-01-15T12:00:00.000Z",
  "configuration": {
    "groq_api_configured": true,
    "debug_mode": false,
    "max_video_duration": 60,
    "frame_sample_rate": 3
  }
}
```

## How It Works: Pose → Text Serialization

The **core innovation** of KineCopilot is the `pose_serializer.py` module, which bridges computer vision and language models.

### The Challenge

- Computer vision outputs: Numerical arrays of (x, y) coordinates and angles
- LLMs need: Contextual, token-efficient text that captures spatial and temporal patterns

### The Solution

`serialize_for_llm()` converts pose sequences into structured text with:

1. **Summary Statistics**: Min/max/mean/std for each joint angle across all frames
2. **Phase Analysis**: Divide movement into thirds (start/mid/end), compute phase averages
3. **Key Moments**: Automatically flag frames with significant deviations (>15° from mean)
4. **Timeline Sample**: Show every 10th frame in a compact table

This representation:
- Reduces a 100-frame sequence from ~30,000 tokens to ~600 tokens
- Preserves temporal patterns the agent needs to spot technique issues
- Enables the LLM to "see" movement without images

### Example Output

```
=== KINECOPILOT POSE ANALYSIS ===
Sport: squat | Level: amateur | Duration: 3.2s | Frames analyzed: 24

JOINT ANGLE SUMMARY (degrees):
Joint                Min    Max   Mean    Std
left_knee           89.2  145.3  112.4   18.2
right_knee          91.1  143.8  111.9   17.6
...

MOVEMENT PHASES:
Phase 1 (frames 0-8):   left_knee=138.2  right_knee=137.1  ...
Phase 2 (frames 9-16):  left_knee=95.3   right_knee=94.8   ...
Phase 3 (frames 17-24): left_knee=140.1  right_knee=139.4  ...

KEY MOMENTS (deviations >15° from mean):
Frame 12 [0.48s]: right_knee=74.1° (CRITICAL: 37.8° below mean)
...
```

## Future Extensions

### Planned Features

1. **MMPose Integration**
   - Swap MediaPipe for MMPose for higher accuracy
   - Stub exists in `pose_extractor.py` with implementation guide
   - Requires: `pip install mmpose mmcv-full mmdet`

2. **3D Pose Estimation**
   - Add depth dimension using multi-view or monocular 3D models
   - Compute true 3D angles instead of 2D projections
   - Better accuracy for depth-dependent movements (e.g., forward lean)

3. **Real-Time Webcam Mode**
   - WebRTC stream processing
   - Live pose overlay
   - Real-time coaching feedback (sub-second latency)

4. **Firebase History & Progress Tracking**
   - Implementation TODOs in `firebase_service.py`
   - User profiles with historical analysis
   - Progress over time visualization
   - Trend analysis (improving/stable/declining)

5. **Multi-Person Analysis**
   - Team sports scenarios
   - Synchronized movement analysis
   - Formation correctness

6. **Export Capabilities**
   - PDF coaching reports
   - Annotated video with pose overlay
   - CSV data export for external analysis

### Contributing

This is an open architecture designed for extension. Key areas:

- Add new sports to `ANGLE_RANGES` in `coaching_agent.py`
- Add correction drills to `CORRECTION_DRILLS`
- Improve pose serialization format in `pose_serializer.py`
- Swap pose models in `pose_extractor.py`

## License

MIT License - see LICENSE file for details

## Credits

- **Pose Extraction**: MediaPipe (Google)
- **LLM Agent**: LangChain + Groq Llama 3.3-70b
- **Framework**: FastAPI + React + Tailwind CSS

---

Built with Claude Code
