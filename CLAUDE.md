# KineCopilot — Claude Code Context

## What this project is
AI sports biomechanics coach. Extracts skeletal pose keypoints from athlete video using
MediaPipe, serializes joint angles into structured text, then runs a LangChain ReAct agent
(backed by Llama 3.3-70b via Groq API) to deliver actionable coaching feedback via a
FastAPI backend.

## Architecture (pipeline order)
```
Video / Pose JSON
  → video_processor.py       (OpenCV frame extraction)
  → pose_extractor.py        (MediaPipe 33-landmark extraction)
  → angle_utils.py           (dot-product joint angle math)
  → pose_serializer.py       (keypoints → LLM-readable structured text)  ← core innovation
  → coaching_agent.py        (LangChain ReAct agent, 4 tools)
  → routers/analysis.py      (FastAPI POST /analyze)
  → KineCopilotPanel.tsx     (Next.js-embeddable React component)
```

## Key design decisions
- **MediaPipe over MMPose** for CPU compatibility and zero-CUDA requirement. MMPose stub exists
  in `pose_extractor.py` for future swap.
- **pose_serializer.py is the multimodal bridge** — converts numerical CV output into
  token-efficient text tables the LLM can reason over. This is the most important file.
- **No database for MVP** — session results cached in a module-level dict in `analysis.py`.
  Firebase stub is in `firebase_service.py` with full TODO structure.
- **Kaggle for heavy precomputation** — Penn Action Dataset processed offline in
  `kaggle_pose_precompute.ipynb`, outputs `PoseSequence` JSON files for fast agent-only runs.
- **Frontend is a drop-in component** — `KineCopilotPanel.tsx` has no router or app wrapper,
  designed to embed directly into a Next.js 14 page.

## Pydantic schema hierarchy
```
KeyPoint → FramePose → PoseSequence → AnalysisRequest
                                    ↓
                          CoachingObservation → AnalysisResponse
```

## LangChain agent tools (in coaching_agent.py)
1. `analyze_joint_angles` — checks angle vs sport-specific normal ranges
2. `lookup_correction_drill` — returns drill for a given issue type (hardcoded dict)
3. `compute_symmetry_score` — flags left/right asymmetries > 8°
4. `generate_overall_score` — produces 0–100 integer score from observations list

## Joint angles computed (angle_utils.py)
left_knee, right_knee, left_hip, right_hip, left_elbow, right_elbow,
left_shoulder, right_shoulder, spine_lean

## Environment variables (.env)
| Variable | Purpose |
|---|---|
| `GROQ_API_KEY` | Required. Groq API key for the coaching agent (uses Llama 3.3-70b). |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Optional. JSON string for Firebase admin SDK. |
| `KINECOPILOT_DEBUG` | `true` enables verbose logging. |
| `MAX_VIDEO_DURATION_SECONDS` | Default 60. Hard cap on uploaded video length. |
| `FRAME_SAMPLE_RATE` | Default 3. Process every Nth frame from video. |

## API endpoints
- `POST /analyze` — multipart/form-data: `video` (file) OR `pose_json` (str), `sport`, `athlete_level`
- `GET /analyze/{session_id}` — retrieve cached result
- `GET /health` — liveness check

## File ownership map
| File | Responsibility |
|---|---|
| `angle_utils.py` | Pure math only. No I/O, no imports beyond numpy. |
| `pose_extractor.py` | MediaPipe only. Returns `List[FramePose]`. |
| `pose_serializer.py` | Text formatting only. No LLM calls here. |
| `coaching_agent.py` | All LLM/LangChain logic lives here. |
| `video_processor.py` | All OpenCV/file I/O lives here. |
| `firebase_service.py` | Stub only. No real Firebase calls until TODO is implemented. |

## Current status
<!-- Claude Code: update this session after each work session -->
- [x] Backend completely built (FastAPI + all services + routers)
- [x] All Python files pass py_compile syntax check
- [x] Firebase stub wired up with full TODO documentation
- [x] README finalized with complete documentation
- [x] Kaggle notebook created for Penn Action Dataset processing
- [x] Frontend prototype files exist (KineCopilot.html + kinecopilot-app.jsx)
- [x] Initial KineCopilotPanel.tsx component created
- [x] claude_design.md integration instructions exist
- [x] **Test data created** (sample_squat_pose.json + test scripts)
- [x] **Video processing pipeline fully implemented** (OpenCV + MediaPipe)
- [x] **MediaPipe auto-download configured** (no manual model downloads needed)
- [x] **Groq rate limit optimizations applied** (reduced tokens, condensed frames)
- [x] **Backend tested with video upload** (Groq rate limits encountered, optimizations applied)
- [ ] Backend fully tested end-to-end with Groq Dev Tier or wait period between requests
- [ ] Frontend component tested in Next.js environment
- [ ] Frontend styling updated to match design prototypes (monochrome theme)

## Known issues / TODOs
<!-- Claude Code: append issues discovered during development here -->
- **Backend**:
  - **Groq Rate Limits**: Free tier has 12,000 tokens/minute limit. Optimizations made:
    * Reduced max_frames from 10 to 5 in pose data condensing
    * Reduced max_tokens from 4000 to 2048 in LLM responses
    * If still hitting limits: wait 15 seconds or upgrade to Groq Dev Tier
  - MMPose integration pending (stub exists in pose_extractor.py)
  - Firebase service not implemented (stub only)
  - Session cache is in-memory only — resets on server restart
  - MediaPipe model auto-downloads on first use (~26MB from Google servers)
  - Video processing uses `/tmp/` directory - may need adjustment for Windows deployment

- **Frontend**:
  - Two versions exist:
    * `frontend/KineCopilotPanel.tsx` - Initial version (basic implementation)
    * `frontend/KineCopilot.html` + `frontend/kinecopilot-app.jsx` - Design prototypes (monochrome theme, complete UX)
  - Need to update KineCopilotPanel.tsx to match the prototype design specifications
  - No Next.js application structure exists yet (only standalone component)
  - `claude_design.md` provides integration instructions for existing Next.js app (not yet set up)

- **Testing**:
  - Need sample video files for end-to-end testing (squat, running, tennis serve, etc.)
  - Kaggle notebook is for Penn Action Dataset pre-processing only (optional, not required for video uploads)

## How to run backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env   # add your ANTHROPIC_API_KEY
uvicorn main:app --reload --port 8000
```

## How to test the backend

### Quick Test (curl)
```bash
cd test_data
curl -X POST http://localhost:8000/analyze \
  -F "pose_json=@sample_squat_pose.json" \
  -F "sport=squat" \
  -F "athlete_level=amateur"
```

### Comprehensive Test Suite (Python)
```bash
cd test_data
python test_api.py
```

### All Examples (bash script)
```bash
cd test_data
chmod +x curl_examples.sh
./curl_examples.sh
```

## Project structure created
```
kinecopilot/
├── backend/
│   ├── main.py                      ✓
│   ├── requirements.txt             ✓
│   ├── .env.example                 ✓
│   ├── routers/
│   │   ├── __init__.py              ✓
│   │   ├── analysis.py              ✓
│   │   └── health.py                ✓
│   ├── services/
│   │   ├── __init__.py              ✓
│   │   ├── pose_extractor.py        ✓
│   │   ├── pose_serializer.py       ✓
│   │   ├── coaching_agent.py        ✓
│   │   ├── firebase_service.py      ✓
│   │   └── video_processor.py       ✓
│   ├── models/
│   │   ├── __init__.py              ✓
│   │   └── schemas.py               ✓
│   └── utils/
│       ├── __init__.py              ✓
│       └── angle_utils.py           ✓
├── frontend/
│   ├── KineCopilotPanel.tsx         ✓
│   ├── KineCopilot.html             ✓ (design reference)
│   └── kinecopilot-app.jsx          ✓ (prototype implementation)
├── notebooks/
│   └── kaggle_pose_precompute.ipynb ✓
├── test_data/
│   ├── sample_squat_pose.json       ✓
│   ├── test_api.py                  ✓
│   ├── curl_examples.sh             ✓
│   └── README.md                    ✓
├── claude_design.md                 ✓
├── CLAUDE.md                        ✓
└── README.md                        ✓
```

## Next steps for testing

### Backend Testing (Ready to run!)
1. Set up .env file with ANTHROPIC_API_KEY:
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env and add your key
   ```

2. Install dependencies and start server:
   ```bash
   pip install -r requirements.txt
   uvicorn main:app --reload --port 8000
   ```

3. Run test suite (in another terminal):
   ```bash
   cd test_data
   python test_api.py
   ```

### Frontend Testing
1. Option A: Update `frontend/KineCopilotPanel.tsx` to match the design prototypes
2. Option B: Set up a Next.js app and integrate following `claude_design.md`
3. Test component rendering and API integration

### Full Pipeline Testing
1. Get a sample video (squat, running, etc.)
2. Use the video upload feature
3. Verify end-to-end: video → pose → serialization → agent → results
