import requests
import time

URL = "http://localhost:5000/api/verify-network"
PAYLOAD = {"studentId": "test_student", "sessionId": "session_123"}
HEADERS = {"Content-Type": "application/json"}

def log_test(name, result, passed=True):
    status = "[PASS]" if passed else "[FAIL]"
    print(f"{status} | {name}: {result}")

print("\n--- STEP 1 & 2: API Validation & Polling (5 iterations) ---")
for i in range(5):
    try:
        resp = requests.post(URL, json=PAYLOAD, headers=HEADERS)
        data = resp.json()
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        assert "verified" in data, "Missing 'verified' in response"
        log_test(f"Poll {i+1}", f"Status: {resp.status_code}, Response: {data}")
    except Exception as e:
        log_test(f"Poll {i+1}", f"Error: {str(e)}", passed=False)
    time.sleep(1)

print("\nAll standard API & Polling tests complete.")
