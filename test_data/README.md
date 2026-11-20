# KineCopilot Test Data

This directory contains sample data and test scripts for the KineCopilot API.

## Files

### Sample Data
- **`sample_squat_pose.json`** - Complete pose sequence for a squat movement
  - 24 frames sampled at 30 fps
  - Includes all 33 MediaPipe landmarks per frame
  - Pre-computed joint angles (9 joints)
  - Summary statistics
  - Demonstrates knee valgus collapse issue (right knee at frame 12)

### Test Scripts
- **`test_api.py`** - Comprehensive Python test suite
- **`curl_examples.sh`** - Quick curl commands for manual testing

## Quick Start

### 1. Start the Backend Server

```bash
cd ../backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
uvicorn main:app --reload --port 8000
```

### 2. Run the Test Suite

```bash
cd ../test_data
python test_api.py
```

This will run 4 tests:
1. Health check
2. Analysis with pose JSON
3. Cached result retrieval
4. Error handling

### 3. Manual Testing with curl

```bash
# Health check
curl http://localhost:8000/health

# Analyze with pose JSON
curl -X POST http://localhost:8000/analyze \
  -F "pose_json=@sample_squat_pose.json" \
  -F "sport=squat" \
  -F "athlete_level=amateur"
```

## Expected Test Results

When running `test_api.py` with a valid ANTHROPIC_API_KEY, you should see:

```
ANALYSIS RESULT:
----------------------------------------------------------------
Session ID: <uuid>
Sport: squat
Overall Score: 70-80/100
Processing Time: 2000-5000ms

Summary:
Good overall depth and spine neutrality. Primary issue is right knee
valgus collapse at the bottom of the movement...

Observations: 4-5 findings

  1. [CRITICAL] right_knee
     Right knee collapses inward at 74.1° at bottom position...
     Drill: Banded squat walkouts...

  2. [WARNING] right_hip
     Right hip flexion 11.2° less than left...

  3. [GOOD] spine_lean
     Spine angle consistent at 42–48° forward lean...

  4. [GOOD] left_knee
     Left knee tracking well over toes...

Key Frames: [12, 18, 24]
```

## Troubleshooting

### "Could not connect to API"
- Make sure the backend server is running: `uvicorn main:app --reload --port 8000`
- Check the server is on port 8000
- Verify no firewall is blocking localhost:8000

### "ANTHROPIC_API_KEY environment variable is required"
- Add your Claude API key to `backend/.env`
- Restart the backend server after adding the key

### "Analysis takes too long"
- Normal processing time: 2-5 seconds
- The LangChain agent makes multiple LLM calls
- Set `KINECOPILOT_DEBUG=true` in .env to see detailed logs

### "Invalid pose sequence data"
- Ensure the JSON matches the `PoseSequence` schema
- Check that all required fields are present
- Verify joint_angles dict has valid float values

## Adding More Test Cases

Create additional pose JSON files for different sports:

```json
{
  "sport": "running",
  "fps": 30.0,
  "total_frames": 30,
  "frames": [...],
  "summary_stats": {...}
}
```

Sports to test:
- `squat` (provided)
- `running`
- `tennis_serve`
- `push-up`
- `deadlift`
- `general`

## CI/CD Integration

To run tests in CI:

```bash
# Install dependencies
pip install -r backend/requirements.txt

# Start server in background
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000 &
sleep 5  # Wait for server to start

# Run tests
cd ../test_data
python test_api.py

# Stop server
pkill -f uvicorn
```

## Performance Benchmarks

Expected performance on modest hardware:

| Operation | Time | Notes |
|-----------|------|-------|
| Health check | <50ms | Simple status response |
| Pose JSON analysis | 2-5s | Includes LLM agent reasoning |
| Cache retrieval | <100ms | In-memory lookup |
| Video processing (30s @ 30fps) | 10-20s | Frame extraction + pose detection |

## Next Steps

1. **Test with real video files** - Use the `/analyze` endpoint with `video` parameter
2. **Batch processing** - Use the Kaggle notebook for large datasets
3. **Load testing** - Test concurrent requests with tools like `ab` or `locust`
4. **Integration testing** - Test the full pipeline including frontend component
