# ============================================================
#  Firebase Configuration — PLACEHOLDER FILE
# ============================================================
#  STEP 1: Go to https://console.firebase.google.com
#  STEP 2: Create a new project (or open an existing one)
#  STEP 3: Go to Project Settings → Service Accounts
#  STEP 4: Click "Generate new private key" and download the JSON
#  STEP 5: Save that JSON as "serviceAccountKey.json" in this folder
#  STEP 6: Replace the PLACEHOLDER values below with your real values
#          (found in Project Settings → General → Your apps → Web app)
# ============================================================

import sys
import os
import json
import firebase_admin
from firebase_admin import credentials, firestore

# Add parent dir to path so we can import services
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from services.mock_firestore import MockFirestoreClient

# ── Path to your downloaded service account key ──────────────────────────────
SERVICE_ACCOUNT_PATH = os.path.join(os.path.dirname(__file__), "serviceAccountKey.json")

# ── Initialize Firebase Admin SDK ────────────────────────────────────────────
def init_firebase():
    """Call this once at app startup to initialize Firebase Admin."""
    use_mock = os.environ.get("USE_MOCK_FIRESTORE", "False").lower() == "true"
    if use_mock:
        print("[OK] Using Mock Firestore Client")
        return
        
    if not firebase_admin._apps:
        # Priority 1: Credentials from environment variable (for cloud deployment)
        cred_json = os.environ.get("GOOGLE_CREDENTIALS_JSON")
        if cred_json:
            try:
                cred_dict = json.loads(cred_json)
                cred = credentials.Certificate(cred_dict)
                firebase_admin.initialize_app(cred)
                print("[OK] Firebase initialized from GOOGLE_CREDENTIALS_JSON env var")
                return
            except Exception as e:
                print(f"⚠️  Failed to parse GOOGLE_CREDENTIALS_JSON: {e}")

        # Priority 2: Local service account key file
        if os.path.exists(SERVICE_ACCOUNT_PATH):
            cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
            firebase_admin.initialize_app(cred)
            print("[OK] Firebase initialized from serviceAccountKey.json")
        else:
            # Fallback: initialize without credentials (limited access)
            print("⚠️  WARNING: No Firebase credentials found.")
            print("   Set GOOGLE_CREDENTIALS_JSON env var or add serviceAccountKey.json")
            firebase_admin.initialize_app()

def get_db():
    """Returns a Firestore client. Call init_firebase() first."""
    use_mock = os.environ.get("USE_MOCK_FIRESTORE", "False").lower() == "true"
    if use_mock:
        return MockFirestoreClient()
    return firestore.client()
