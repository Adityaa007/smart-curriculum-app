"""
Smart Curriculum and Attendance App — Flask Backend
Phase 1: Auth-support API + User Profile Management

The React frontend handles Firebase Auth (login/register) directly.
This Flask API handles:
  - Verifying Firebase ID tokens (server-side validation)
  - Reading/writing user profiles to Firestore
  - Protected API routes for future features (attendance, QR, etc.)
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from firebase_admin import firestore, auth as firebase_auth
import sys
import os
import json
import re
from dotenv import load_dotenv

# Add config directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "config"))
from firebase_config import init_firebase, get_db

app = Flask(__name__)

# CORS: allow localhost in dev + the deployed frontend in production
cors_origins = os.environ.get("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
CORS(app, origins=[o.strip() for o in cors_origins])

load_dotenv()
try:
    import google.generativeai as genai
    if os.environ.get("GEMINI_API_KEY"):
        genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
except ImportError:
    pass


# Initialize Firebase on startup
try:
    init_firebase()
    print("[OK] Firebase Admin SDK initialized")
except Exception as e:
    print(f"[Warning] Firebase init skipped (no credentials): {e}")


# ── Utilities ────────────────────────────────────────────────────────────────

def verify_token(request):
    """Extract and verify Firebase ID token from Authorization header."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None, "Missing or invalid Authorization header"
    id_token = auth_header.split("Bearer ")[1]
    try:
        decoded = firebase_auth.verify_id_token(id_token)
        return decoded, None
    except Exception as e:
        return None, str(e)


# ── Health Check ─────────────────────────────────────────────────────────────

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "message": "Smart Curriculum API is running"})


# ── User Profile ─────────────────────────────────────────────────────────────

@app.route("/api/user", methods=["POST"])
def create_or_update_user():
    """
    Create or update a user's profile in Firestore.
    Called after Firebase Auth registration on the frontend.
    Body: { uid, name, email, role, rollNumber?, section? }
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    required = ["uid", "name", "email", "role"]
    for field in required:
        if field not in data:
            return jsonify({"error": f"Missing field: {field}"}), 400

    try:
        db = get_db()
        user_ref = db.collection("users").document(data["uid"])

        profile = {
            "name": data["name"],
            "email": data["email"],
            "role": data["role"],
            "createdAt": firestore.SERVER_TIMESTAMP,
        }

        if data["role"] == "student":
            profile["rollNumber"] = data.get("rollNumber", "")
            profile["section"] = data.get("section", "")
            profile["attendance"] = data.get("attendance", 85)  # Phase 1 placeholder

        user_ref.set(profile, merge=True)
        return jsonify({"success": True, "uid": data["uid"]}), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/user/<uid>", methods=["GET"])
def get_user(uid):
    """
    Fetch a user's profile from Firestore.
    Requires a valid Firebase ID token in the Authorization header.
    """
    decoded, err = verify_token(request)
    if err:
        return jsonify({"error": err}), 401

    try:
        db = get_db()
        doc = db.collection("users").document(uid).get()
        if doc.exists:
            return jsonify({"user": doc.to_dict()}), 200
        else:
            return jsonify({"error": "User not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500



# ── Future Phase Endpoints (stubs) ───────────────────────────────────────────

# ── Daily Routine Generator ──────────────────────────────────────────────────


@app.route("/api/generate-routine", methods=["POST"])
def generate_routine():
    print("ROUTINE API HIT")
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    req_type = data.get("type", "full")  # 'full' or 'single'
    interests = data.get("interests", "General learning")
    strengths = data.get("strengths", "Adaptable")
    career_goal = data.get("careerGoal", "Professional development")
    preference = data.get("studyPreference", "Morning")
    free_time = data.get("dailyFreeTime", 2)
    timetable = data.get("timetable", [])
    free_periods = data.get("freePeriods", [])

    def get_fallback_routine():
        return [
            {"time": "07:00 AM", "endTime": "08:00 AM", "activity": "Morning Routine", "description": "Wake up, freshen up, and light breakfast.", "category": "Break", "priority": "Medium", "icon": "🌅", "status": "pending"},
            {"time": "08:00 AM", "endTime": "09:00 AM", "activity": "Deep Work Study", "description": "Focus on the most difficult subject of the day.", "category": "Study", "priority": "High", "icon": "📚", "status": "pending"},
            {"time": "09:00 AM", "endTime": "01:00 PM", "activity": "University Classes", "description": "Attend scheduled lectures and labs.", "category": "Class", "priority": "High", "icon": "🏫", "status": "pending"},
            {"time": "01:00 PM", "endTime": "02:00 PM", "activity": "Lunch Break", "description": "Nutritious meal and brief relaxation.", "category": "Meal", "priority": "Medium", "icon": "🍱", "status": "pending"},
            {"time": "02:00 PM", "endTime": "05:00 PM", "activity": "Afternoon Session", "description": "Practical work, assignments, or additional study.", "category": "Study", "priority": "Medium", "icon": "💻", "status": "pending"},
            {"time": "05:00 PM", "endTime": "06:00 PM", "activity": "Physical Exercise", "description": "Workout, sports, or a brisk walk.", "category": "Exercise", "priority": "Medium", "icon": "🏃", "status": "pending"},
            {"time": "06:00 PM", "endTime": "07:00 PM", "activity": "Personal Time", "description": "Hobbies, social time, or relaxing activities.", "category": "Personal", "priority": "Low", "icon": "🎨", "status": "pending"},
            {"time": "07:00 PM", "endTime": "08:00 PM", "activity": "Dinner", "description": "Balanced dinner and light conversation.", "category": "Meal", "priority": "Medium", "icon": "🥗", "status": "pending"},
            {"time": "08:00 PM", "endTime": "10:00 PM", "activity": "Evening Revision", "description": "Review the day's learning and prep for tomorrow.", "category": "Study", "priority": "Medium", "icon": "📋", "status": "pending"},
            {"time": "10:00 PM", "endTime": "11:00 PM", "activity": "Wind Down", "description": "Reading or meditation before sleep.", "category": "Sleep", "priority": "Low", "icon": "🌙", "status": "pending"}
        ]

    if req_type == "full":
        prompt = f"""
You are a personal academic coach AI. Create a detailed daily routine for a college student (7 AM to 11 PM).

Student Profile:
* Career Goal: {career_goal}
* Interests: {interests}
* Strengths: {strengths}
* Preferred Study Time: {preference}
* Daily Free Time Available: {free_time} hours

Schedule Constraints:
* Classes Today: {json.dumps(timetable)}
* Free Periods Today: {json.dumps(free_periods)}

Smart Scheduling Rules:
1. Assign high-intensity/cognitive tasks between 8 AM and 12 PM (Deep Work).
2. Assign lighter, relaxing or creative tasks after 6 PM.
3. Fill remaining time with meals, breaks, exercise, and study.
4. Classes MUST be included at their exact times.
5. Ensure a healthy balance and variety.

Return ONLY a valid JSON array of objects.
Fields: time, endTime, activity (max 6 words), description (max 20 words), category (Class/Study/Break/Meal/Exercise/Personal/Sleep), priority (High/Medium/Low), icon (emoji), status (pending).
"""
    else:
        slot = data.get("slot", {})
        prompt = f"""
You are a personal academic coach AI. Regenerate ONE slot for a student routine.

Time Slot: {slot.get('time')} to {slot.get('endTime')}
Current Activity: {slot.get('activity')}

Return ONLY ONE valid JSON object with fields: time, endTime, activity, description, category, priority, icon, status.
"""

    def call_gemini(p, retry=True):
        try:
            model = genai.GenerativeModel('gemini-1.5-flash')
            response = model.generate_content(p)
            text = response.text.strip()
            
            # Robust JSON extraction
            try:
                return json.loads(text)
            except json.JSONDecodeError:
                match = re.search(r'```(?:json)?\s*(.*?)\s*```', text, re.DOTALL)
                if match:
                    return json.loads(match.group(1).strip())
                raise ValueError("JSON parse failed")
        except Exception as e:
            if retry:
                print("Gemini retry...")
                return call_gemini(p, retry=False)
            raise e

    try:
        result = call_gemini(prompt)
        # Wrap single object in list if necessary
        if isinstance(result, dict) and req_type != "full":
             return jsonify(result), 200
        if not isinstance(result, list):
             raise ValueError("Expected list for full routine")
        return jsonify(result), 200
    except Exception as e:
        print(f"Routine Generation Failure: {str(e)}")
        if req_type == "full":
            return jsonify(get_fallback_routine()), 200
        else:
            # For single slot fallback, just return the original or a generic study block
            return jsonify(data.get("slot", {})), 200



# ── Free Period Tasks ────────────────────────────────────────────────────────

def get_fallback_tasks():
    return [
        {"title": "Skill Drill: Rapid Learning", "description": "Quickly review a topic you've been putting off. Use the Feynman technique.", "duration": 15, "difficulty": "Medium"},
        {"title": "Career Visualization", "description": "Spend time researching one specific role related to your career goals.", "duration": 10, "difficulty": "Easy"},
        {"title": "Note Polishing", "description": "Review and clean up notes from your last class. Add diagrams or highlights.", "duration": 20, "difficulty": "Hard"}
    ]

@app.route("/api/generate-tasks", methods=["POST"])
def generate_free_period_tasks():
    data = request.get_json()
    if not data:
        return jsonify(get_fallback_tasks()), 200

    available_time = data.get("availableTime", 30)
    interests = data.get("interests", "General learning")
    strengths = data.get("strengths", "Adaptable")
    career_goal = data.get("careerGoal", "Professional development")

    prompt = f"""
You are an academic productivity coach. Generate 3 personalized learning tasks for a student during their {available_time}-minute free period.

Student Context:
- Interests: {interests}
- Strengths: {strengths}
- Career Goal: {career_goal}

Constraints:
1. Total duration of ALL 3 tasks combined should be around {available_time} minutes.
2. Each task must have: title (short), description (brief), duration (in minutes), difficulty (Easy/Medium/Hard).
3. Align tasks with the student's career goal and interests.

Return ONLY a JSON array of 3 objects.
"""
    try:
        model = genai.GenerativeModel('gemini-1.5-flash')
        response = model.generate_content(prompt)
        text = response.text.strip()
        
        # JSON extraction
        match = re.search(r'\[.*\]', text, re.DOTALL)
        if match:
            tasks = json.loads(match.group(0))
        else:
            tasks = json.loads(text)
            
        if not isinstance(tasks, list) or len(tasks) == 0:
            tasks = get_fallback_tasks()
            
        # Clamp durations
        for task in tasks:
            try:
                task_dur = int(task.get("duration", 15))
            except (ValueError, TypeError):
                task_dur = 15
            task["duration"] = min(task_dur, available_time)

        return jsonify(tasks), 200

    except Exception as e:
        print(f"Error generating tasks: {str(e)}")
        return jsonify(get_fallback_tasks()), 200


# ── Wi-Fi / Network Proximity Verification ───────────────────────────────────

def ip_to_int(ip_str):
    """Convert dotted IP string to integer for range comparison."""
    try:
        parts = ip_str.strip().split(".")
        if len(parts) != 4:
            return None
        return (int(parts[0]) << 24) + (int(parts[1]) << 16) + (int(parts[2]) << 8) + int(parts[3])
    except (ValueError, AttributeError):
        return None

def mask_ip(ip_str):
    """Mask last octet for privacy: 192.168.1.42 → 192.168.1.xxx"""
    try:
        parts = ip_str.strip().split(".")
        if len(parts) == 4:
            return f"{parts[0]}.{parts[1]}.{parts[2]}.xxx"
    except Exception:
        pass
    return "unknown"


@app.route("/api/verify-network", methods=["POST"])
def verify_network():
    """
    Verify if a student's IP is within the configured college network range.
    Called silently by the student's browser every 30 seconds during an active session.

    Body: { studentId, sessionId }
    Returns: { verified: bool, studentIp: str (masked), message: str }
    """
    data = request.get_json()
    if not data:
        return jsonify({"verified": False, "studentIp": "unknown", "message": "No data provided"}), 400

    student_id = data.get("studentId")
    session_id = data.get("sessionId")

    if not student_id or not session_id:
        return jsonify({"verified": False, "studentIp": "unknown", "message": "Missing studentId or sessionId"}), 400

    # 1. Determine client IP
    client_ip = None
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        # Take the first IP if multiple are chained
        client_ip = forwarded.split(",")[0].strip()
    if not client_ip:
        client_ip = request.remote_addr or ""

    masked = mask_ip(client_ip)
    print(f"[Wi-Fi Check] Student={student_id}, IP={masked}, Session={session_id}")

    # Handle localhost / development IPs
    is_local = client_ip in ("127.0.0.1", "::1", "localhost", "") or client_ip.startswith("::ffff:127.")

    # 2. Fetch network settings from Firestore
    try:
        db = get_db()
        settings_doc = db.collection("settings").document("network").get()

        if not settings_doc.exists:
            print("[Wi-Fi Check] No network settings configured")
            return jsonify({
                "verified": False,
                "studentIp": masked,
                "message": "Network settings not configured. Ask your teacher to set up network settings."
            }), 200

        settings = settings_doc.to_dict()
        simulate = settings.get("simulateCampus", False)

        # 3. Simulate mode — always verify (for local dev/testing)
        if simulate:
            print(f"[Wi-Fi Check] Simulate mode ON — auto-verifying student {student_id}")
            return jsonify({
                "verified": True,
                "studentIp": masked,
                "message": "Verified (campus simulation mode)"
            }), 200

        # 4. Skip check for localhost if not simulating
        if is_local:
            print(f"[Wi-Fi Check] Localhost detected, skipping check for {student_id}")
            return jsonify({
                "verified": False,
                "studentIp": masked,
                "message": "Cannot verify network on localhost. Enable 'Simulate Campus Network' in settings for testing."
            }), 200

        # 5. Check IP against configured range
        ip_prefix = settings.get("ipPrefix", "")
        ip_start = settings.get("ipStart", "")
        ip_end = settings.get("ipEnd", "")

        verified = False

        # Method A: Prefix match (simpler)
        if ip_prefix and client_ip.startswith(ip_prefix):
            verified = True

        # Method B: Range match (more precise)
        if not verified and ip_start and ip_end:
            client_int = ip_to_int(client_ip)
            start_int = ip_to_int(ip_start)
            end_int = ip_to_int(ip_end)

            if client_int is not None and start_int is not None and end_int is not None:
                verified = start_int <= client_int <= end_int

        if verified:
            print(f"[Wi-Fi Check] ✓ Student {student_id} verified on campus network")
            return jsonify({
                "verified": True,
                "studentIp": masked,
                "message": "Verified — on campus network"
            }), 200
        else:
            print(f"[Wi-Fi Check] ✗ Student {student_id} not on campus network ({masked})")
            return jsonify({
                "verified": False,
                "studentIp": masked,
                "message": "Not detected on campus network"
            }), 200

    except Exception as e:
        print(f"[Wi-Fi Check] Error: {str(e)}")
        return jsonify({
            "verified": False,
            "studentIp": masked,
            "message": f"Server error: {str(e)}"
        }), 200


# ── Run ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print("SERVER STARTING...")
    print(f"\nSmart Curriculum API starting on http://127.0.0.1:{port}\n")
    app.run(debug=True, host="0.0.0.0", port=port, use_reloader=False)
