#!/bin/bash
# KineCopilot API - Curl Examples
# Make this file executable: chmod +x curl_examples.sh

API_URL="http://localhost:8000"

echo "==================================================================="
echo "KINECOPILOT API - CURL EXAMPLES"
echo "==================================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Example 1: Health Check
echo -e "${BLUE}Example 1: Health Check${NC}"
echo "Command:"
echo "  curl $API_URL/health"
echo ""
curl -s $API_URL/health | python3 -m json.tool
echo ""
echo "-------------------------------------------------------------------"
echo ""

# Example 2: Analyze with Pose JSON
echo -e "${BLUE}Example 2: Analyze Movement (with pose JSON)${NC}"
echo "Command:"
echo "  curl -X POST $API_URL/analyze \\"
echo "    -F \"pose_json=@sample_squat_pose.json\" \\"
echo "    -F \"sport=squat\" \\"
echo "    -F \"athlete_level=amateur\""
echo ""
echo "Running..."
curl -s -X POST $API_URL/analyze \
  -F "pose_json=@sample_squat_pose.json" \
  -F "sport=squat" \
  -F "athlete_level=amateur" | python3 -m json.tool
echo ""
echo "-------------------------------------------------------------------"
echo ""

# Example 3: Get Specific Session (requires session_id from previous call)
echo -e "${BLUE}Example 3: Get Cached Result${NC}"
echo "First, create an analysis and capture the session_id..."
SESSION_ID=$(curl -s -X POST $API_URL/analyze \
  -F "pose_json=@sample_squat_pose.json" \
  -F "sport=squat" \
  -F "athlete_level=amateur" | python3 -c "import sys, json; print(json.load(sys.stdin)['session_id'])")

echo "Session ID: $SESSION_ID"
echo ""
echo "Command:"
echo "  curl $API_URL/analyze/$SESSION_ID"
echo ""
curl -s $API_URL/analyze/$SESSION_ID | python3 -m json.tool
echo ""
echo "-------------------------------------------------------------------"
echo ""

# Example 4: Different Sports
echo -e "${BLUE}Example 4: Analyze Different Sport${NC}"
echo "Command:"
echo "  curl -X POST $API_URL/analyze \\"
echo "    -F \"pose_json=@sample_squat_pose.json\" \\"
echo "    -F \"sport=running\" \\"
echo "    -F \"athlete_level=intermediate\""
echo ""
echo "(Using squat data with running parameters for demo)"
curl -s -X POST $API_URL/analyze \
  -F "pose_json=@sample_squat_pose.json" \
  -F "sport=running" \
  -F "athlete_level=intermediate" | python3 -c "import sys, json; data = json.load(sys.stdin); print(f\"Score: {data['overall_score']}/100\"); print(f\"Summary: {data['summary'][:150]}...\")"
echo ""
echo "-------------------------------------------------------------------"
echo ""

# Example 5: Error Handling
echo -e "${BLUE}Example 5: Error Handling (Missing Parameters)${NC}"
echo "Command:"
echo "  curl -X POST $API_URL/analyze \\"
echo "    -F \"sport=squat\""
echo ""
echo "(Should return 400 error - missing pose_json and video)"
curl -s -X POST $API_URL/analyze \
  -F "sport=squat" | python3 -m json.tool
echo ""
echo "-------------------------------------------------------------------"
echo ""

echo -e "${GREEN}✓ All examples complete!${NC}"
echo ""
echo "Tips:"
echo "  - Add '| jq' instead of '| python3 -m json.tool' for colored output"
echo "  - Use '-v' flag for verbose output including headers"
echo "  - Use '-o output.json' to save response to file"
echo ""
