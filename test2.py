import requests
import time

URL = "http://localhost:5000/api/verify-network"
PAYLOAD = {"studentId": "test_student", "sessionId": "session_123"}
HEADERS = {"Content-Type": "application/json"}

print("\n--- STEP 4 & 5: Failure Simulation & Dynamic Behavior ---")
for i in range(15):
    try:
        resp = requests.post(URL, json=PAYLOAD, headers=HEADERS)
        data = resp.json()
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        
        msg = data.get("message", "unknown")
        if not data.get("verified") and "error" in msg.lower():
            label = "[EXCEPTION FALLBACK]"
        elif not data.get("verified"):
            label = "[OUTSIDE NETWORK]"
        else:
            label = "[VERIFIED NETWORK]"
        print(f"{label:<25} | HTTP={resp.status_code} | Msg={msg}")

    except Exception as e:
        print(f"CRITICAL FAIL | API crashed or timeout: {str(e)}")
    time.sleep(0.5)

print("\nAll dynamic tests complete.")
