#!/usr/bin/env python3
"""
Test script for KineCopilot API
Tests both endpoints with sample pose data
"""

import requests
import json
import time
from pathlib import Path

# Configuration
API_BASE_URL = "http://localhost:8000"
TEST_DATA_DIR = Path(__file__).parent

def test_health_endpoint():
    """Test the health check endpoint"""
    print("\n" + "="*60)
    print("TEST 1: Health Check Endpoint")
    print("="*60)

    try:
        response = requests.get(f"{API_BASE_URL}/health")
        print(f"Status Code: {response.status_code}")
        print(f"Response:\n{json.dumps(response.json(), indent=2)}")

        if response.status_code == 200:
            print("✓ Health check passed")
            return True
        else:
            print("✗ Health check failed")
            return False
    except requests.exceptions.ConnectionError:
        print("✗ Could not connect to API. Is the server running?")
        print("  Start with: uvicorn main:app --reload --port 8000")
        return False
    except Exception as e:
        print(f"✗ Error: {e}")
        return False


def test_analyze_with_pose_json():
    """Test the analyze endpoint with precomputed pose JSON"""
    print("\n" + "="*60)
    print("TEST 2: Analysis Endpoint (with pose JSON)")
    print("="*60)

    # Load sample pose data
    pose_file = TEST_DATA_DIR / "sample_squat_pose.json"

    if not pose_file.exists():
        print(f"✗ Sample pose file not found: {pose_file}")
        return False

    with open(pose_file, 'r') as f:
        pose_data = json.load(f)

    print(f"Loaded pose data: {pose_data['sport']} - {pose_data['total_frames']} frames")

    # Prepare request
    data = {
        'pose_json': json.dumps(pose_data),
        'sport': 'squat',
        'athlete_level': 'amateur'
    }

    try:
        print("\nSending request to /analyze...")
        start_time = time.time()

        response = requests.post(
            f"{API_BASE_URL}/analyze",
            data=data
        )

        elapsed = (time.time() - start_time) * 1000

        print(f"Status Code: {response.status_code}")
        print(f"Request took: {elapsed:.0f}ms")

        if response.status_code == 200:
            result = response.json()
            print("\n" + "-"*60)
            print("ANALYSIS RESULT:")
            print("-"*60)
            print(f"Session ID: {result['session_id']}")
            print(f"Sport: {result['sport']}")
            print(f"Overall Score: {result['overall_score']}/100")
            print(f"Processing Time: {result['processing_time_ms']:.0f}ms")
            print(f"\nSummary:\n{result['summary']}")
            print(f"\nObservations: {len(result['observations'])} findings")

            for i, obs in enumerate(result['observations'], 1):
                print(f"\n  {i}. [{obs['severity'].upper()}] {obs['joint']}")
                print(f"     {obs['observation']}")
                if obs.get('drill'):
                    print(f"     Drill: {obs['drill'][:80]}...")

            print(f"\nKey Frames: {result['key_frames']}")
            print(f"\nAgent Reasoning Preview:")
            print(f"{result['agent_reasoning'][:200]}...")

            print("\n✓ Analysis completed successfully")
            return True
        else:
            print(f"✗ Analysis failed")
            try:
                error = response.json()
                print(f"Error: {json.dumps(error, indent=2)}")
            except:
                print(f"Response: {response.text}")
            return False

    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_get_cached_result():
    """Test retrieving a cached analysis result"""
    print("\n" + "="*60)
    print("TEST 3: Get Cached Result")
    print("="*60)

    # First, create a result to cache
    pose_file = TEST_DATA_DIR / "sample_squat_pose.json"
    with open(pose_file, 'r') as f:
        pose_data = json.load(f)

    data = {
        'pose_json': json.dumps(pose_data),
        'sport': 'squat',
        'athlete_level': 'amateur'
    }

    try:
        # Create analysis
        response = requests.post(f"{API_BASE_URL}/analyze", data=data)

        if response.status_code != 200:
            print("✗ Could not create initial analysis")
            return False

        session_id = response.json()['session_id']
        print(f"Created analysis with session_id: {session_id}")

        # Retrieve cached result
        print(f"\nRetrieving cached result...")
        response = requests.get(f"{API_BASE_URL}/analyze/{session_id}")

        print(f"Status Code: {response.status_code}")

        if response.status_code == 200:
            result = response.json()
            print(f"Retrieved session: {result['session_id']}")
            print(f"Score: {result['overall_score']}/100")
            print("✓ Cache retrieval successful")
            return True
        else:
            print("✗ Cache retrieval failed")
            return False

    except Exception as e:
        print(f"✗ Error: {e}")
        return False


def test_error_handling():
    """Test error handling with invalid data"""
    print("\n" + "="*60)
    print("TEST 4: Error Handling")
    print("="*60)

    tests = [
        {
            "name": "Missing both video and pose_json",
            "data": {'sport': 'squat', 'athlete_level': 'amateur'},
            "expected_status": 400
        },
        {
            "name": "Invalid JSON in pose_json",
            "data": {'pose_json': '{invalid json}', 'sport': 'squat', 'athlete_level': 'amateur'},
            "expected_status": 400
        },
        {
            "name": "Retrieve non-existent session",
            "endpoint": "/analyze/nonexistent_session_id",
            "method": "GET",
            "expected_status": 404
        }
    ]

    all_passed = True

    for test in tests:
        print(f"\n  Testing: {test['name']}")

        try:
            if test.get('method') == 'GET':
                response = requests.get(f"{API_BASE_URL}{test['endpoint']}")
            else:
                response = requests.post(f"{API_BASE_URL}/analyze", data=test['data'])

            if response.status_code == test['expected_status']:
                print(f"  ✓ Correctly returned {response.status_code}")
            else:
                print(f"  ✗ Expected {test['expected_status']}, got {response.status_code}")
                all_passed = False

        except Exception as e:
            print(f"  ✗ Error: {e}")
            all_passed = False

    return all_passed


def main():
    """Run all tests"""
    print("\n" + "="*60)
    print("KINECOPILOT API TEST SUITE")
    print("="*60)
    print(f"Testing API at: {API_BASE_URL}")
    print(f"Test data dir: {TEST_DATA_DIR}")

    results = {
        "Health Check": test_health_endpoint(),
    }

    if results["Health Check"]:
        # Only run other tests if health check passes
        results["Pose JSON Analysis"] = test_analyze_with_pose_json()
        results["Cache Retrieval"] = test_get_cached_result()
        results["Error Handling"] = test_error_handling()
    else:
        print("\n⚠️  Skipping other tests due to failed health check")
        print("   Make sure the server is running and ANTHROPIC_API_KEY is set")

    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)

    for test_name, passed in results.items():
        status = "✓ PASSED" if passed else "✗ FAILED"
        print(f"{test_name:<30} {status}")

    total = len(results)
    passed = sum(results.values())

    print(f"\nTotal: {passed}/{total} tests passed")

    if passed == total:
        print("\n🎉 All tests passed!")
        return 0
    else:
        print("\n⚠️  Some tests failed")
        return 1


if __name__ == "__main__":
    exit(main())
