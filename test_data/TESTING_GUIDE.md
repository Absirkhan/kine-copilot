# KineCopilot Backend Testing Guide

Complete guide to testing the KineCopilot API with the provided test data.

## Prerequisites

1. **Python 3.11+** installed
2. **Anthropic API key** (get from https://console.anthropic.com/)
3. **Backend dependencies** installed

## Setup (5 minutes)

### Step 1: Configure Environment

```bash
cd backend
cp .env.example .env
```

Edit `.env` and add your API key:
```
ANTHROPIC_API_KEY=sk-ant-api03-...your-key-here...
```

### Step 2: Install Dependencies

```bash
pip install -r requirements.txt
```

### Step 3: Start the Server

```bash
uvicorn main:app --reload --port 8000
```

You should see:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete.
============================================================
KineCopilot API Starting...
Debug mode: true
Max video duration: 60s
Frame sample rate: 3
Anthropic API: Configured ✓
============================================================
```

## Testing Methods

### Method 1: Automated Test Suite (Recommended)

Open a **new terminal** and run:

```bash
cd test_data
python test_api.py
```

**Expected output:**
```
============================================================
KINECOPILOT API TEST SUITE
============================================================
Testing API at: http://localhost:8000
Test data dir: /path/to/test_data

============================================================
TEST 1: Health Check Endpoint
============================================================
Status Code: 200
Response:
{
  "status": "healthy",
  "service": "KineCopilot API",
  ...
}
✓ Health check passed

============================================================
TEST 2: Analysis Endpoint (with pose JSON)
============================================================
Loaded pose data: squat - 24 frames

Sending request to /analyze...
Status Code: 200
Request took: 3240ms

------------------------------------------------------------
ANALYSIS RESULT:
------------------------------------------------------------
Session ID: kc_<uuid>
Sport: squat
Overall Score: 74/100
Processing Time: 3240ms

Summary:
Good overall depth and spine neutrality. Primary issue is right knee
valgus collapse at the bottom of the movement (frame 12), with a
secondary asymmetry in hip flexion angle...

Observations: 4 findings

  1. [CRITICAL] right_knee
     Right knee collapses inward at 74.1° at bottom position...
     Drill: Banded squat walkouts: 3 sets of 12 reps...

  2. [WARNING] right_hip
     Right hip flexion 11.2° less than left...

  3. [GOOD] spine_lean
     Spine angle consistent at 42–48° forward lean...

  4. [GOOD] left_knee
     Left knee tracking well over toes...

Key Frames: [12, 18, 24]
✓ Analysis completed successfully

============================================================
TEST SUMMARY
============================================================
Health Check                    ✓ PASSED
Pose JSON Analysis              ✓ PASSED
Cache Retrieval                 ✓ PASSED
Error Handling                  ✓ PASSED

Total: 4/4 tests passed

🎉 All tests passed!
```

### Method 2: Manual curl Testing

#### Test 1: Health Check
```bash
curl http://localhost:8000/health | python -m json.tool
```

#### Test 2: Simple Analysis
```bash
cd test_data
curl -X POST http://localhost:8000/analyze \
  -F "pose_json=@sample_squat_pose.json" \
  -F "sport=squat" \
  -F "athlete_level=amateur" \
  | python -m json.tool
```

#### Test 3: Different Athlete Levels
```bash
# Amateur (default - more forgiving)
curl -X POST http://localhost:8000/analyze \
  -F "pose_json=@sample_squat_pose.json" \
  -F "sport=squat" \
  -F "athlete_level=amateur"

# Intermediate
curl -X POST http://localhost:8000/analyze \
  -F "pose_json=@sample_squat_pose.json" \
  -F "sport=squat" \
  -F "athlete_level=intermediate"

# Advanced (stricter criteria)
curl -X POST http://localhost:8000/analyze \
  -F "pose_json=@sample_squat_pose.json" \
  -F "sport=squat" \
  -F "athlete_level=advanced"
```

#### Test 4: Get Cached Result
```bash
# First, get a session_id from an analysis
SESSION_ID=$(curl -s -X POST http://localhost:8000/analyze \
  -F "pose_json=@sample_squat_pose.json" \
  -F "sport=squat" \
  -F "athlete_level=amateur" \
  | python -c "import sys, json; print(json.load(sys.stdin)['session_id'])")

# Then retrieve it
curl http://localhost:8000/analyze/$SESSION_ID | python -m json.tool
```

### Method 3: Bash Script with All Examples

```bash
cd test_data
chmod +x curl_examples.sh
./curl_examples.sh
```

This runs all curl examples with formatted output.

## Understanding the Test Data

The **`sample_squat_pose.json`** file contains:

- **Sport**: Squat movement
- **Frames**: 24 frames (4 key frames shown: 0, 3, 12, 24)
- **Duration**: ~800ms at 30 fps
- **Issue**: Right knee valgus collapse at frame 12 (74.1° angle)

### Key Frame Breakdown:

| Frame | Phase | Right Knee Angle | Issue |
|-------|-------|------------------|-------|
| 0 | Start (standing) | 141.8° | ✓ Good |
| 3 | Descent | 124.8° | ✓ Good |
| **12** | **Bottom** | **74.1°** | ✗ **Valgus collapse** |
| 24 | Return | 139.4° | ✓ Good |

## Expected Agent Behavior

The LangChain agent should:

1. **Analyze joint angles** using `analyze_joint_angles` tool
   - Compare each angle against sport-specific ranges
   - Detect the right knee at 74.1° is 37.8° below mean

2. **Check symmetry** using `compute_symmetry_score` tool
   - Find 11.2° hip asymmetry (right tighter than left)

3. **Look up drills** using `lookup_correction_drill` tool
   - Recommend "Banded squat walkouts" for valgus collapse
   - Recommend "90/90 hip stretch" for hip mobility

4. **Generate score** using `generate_overall_score` tool
   - Start at 100
   - Deduct 15 points for critical issue (knee collapse)
   - Deduct 5 points for warning (hip asymmetry)
   - Final score: ~74-80/100

5. **Provide reasoning trace**
   - Shows step-by-step thought process
   - References specific angles and frames
   - Explains scoring logic

## Troubleshooting

### Error: "Could not connect to API"

**Solution**: Make sure the backend server is running
```bash
cd backend
uvicorn main:app --reload --port 8000
```

### Error: "ANTHROPIC_API_KEY environment variable is required"

**Solution**: Add your API key to `.env`
```bash
cd backend
echo "ANTHROPIC_API_KEY=sk-ant-api03-..." > .env
# Then restart the server
```

### Error: "Invalid pose sequence data"

**Solution**: Ensure you're in the correct directory
```bash
cd test_data  # Must be in test_data/ to find sample_squat_pose.json
python test_api.py
```

### Warning: "Tool call failed" in agent logs

This is **normal** - the agent may retry or adjust its approach. As long as you get a final result, the system is working.

### Analysis takes a long time (>10 seconds)

**Expected behavior**:
- Normal: 2-5 seconds
- Slow: 5-10 seconds (API rate limits)
- Very slow: >10 seconds (check network/API status)

Set `KINECOPILOT_DEBUG=true` in `.env` to see detailed logs.

## Next Steps

Once basic testing works:

### 1. Test with Real Video

```bash
curl -X POST http://localhost:8000/analyze \
  -F "video=@my_squat_video.mp4" \
  -F "sport=squat" \
  -F "athlete_level=amateur"
```

### 2. Create More Test Cases

Generate pose JSON for other sports using the Kaggle notebook:
- Running
- Tennis serve
- Push-ups
- Deadlifts

### 3. Integration Testing

Test the full stack with the frontend component.

### 4. Performance Testing

Use tools like `ab` (ApacheBench) or `locust` for load testing:

```bash
# Install ApacheBench
sudo apt-get install apache2-utils  # Linux
brew install httpd  # macOS

# Run 100 requests, 10 concurrent
ab -n 100 -c 10 http://localhost:8000/health
```

## API Response Reference

### Successful Response Structure
```json
{
  "session_id": "uuid-string",
  "sport": "squat",
  "overall_score": 74,
  "summary": "Overall assessment text...",
  "observations": [
    {
      "joint": "right_knee",
      "severity": "critical",
      "observation": "Detailed observation...",
      "correction": "How to fix...",
      "drill": "Specific exercise..."
    }
  ],
  "key_frames": [12, 18, 24],
  "agent_reasoning": "Step-by-step thought process...",
  "processing_time_ms": 3240.5
}
```

### Error Response Structure
```json
{
  "detail": "Error message explaining what went wrong"
}
```

## Performance Benchmarks

On modest hardware (4-core CPU, 8GB RAM):

| Endpoint | Method | Time | Notes |
|----------|--------|------|-------|
| `/health` | GET | <50ms | Simple status check |
| `/analyze` (pose JSON) | POST | 2-5s | Includes LLM reasoning |
| `/analyze` (video, 10s) | POST | 8-15s | Includes pose extraction |
| `/analyze/{id}` | GET | <100ms | Cache lookup |

## Support

If tests fail:

1. Check server logs for detailed error messages
2. Verify `ANTHROPIC_API_KEY` is valid
3. Ensure all dependencies are installed
4. Try with `KINECOPILOT_DEBUG=true` for verbose output
5. Check [CLAUDE.md](../CLAUDE.md) for known issues

## Success Criteria

✅ You're ready to proceed if:
- Health check returns 200
- Pose JSON analysis completes in <10s
- Results include 3-5 observations
- Agent reasoning is present
- Score is between 0-100
- All 4 automated tests pass

Happy testing! 🎉
