# 🎓 Smart Curriculum & Attendance App — Phase 1

A full-stack web app with **React + Tailwind CSS** frontend and **Python Flask** backend.

---

## 🔥 Firebase Setup (Required Before Running)

### Step 1 — Create a Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click **Add project** → enter a name → click through setup

### Step 2 — Enable Authentication
1. In your project → **Authentication** → **Sign-in method**
2. Enable **Email/Password**

### Step 3 — Create Firestore Database
1. **Firestore Database** → **Create database**
2. Choose **Start in test mode** → select a region → Done

### Step 4 — Get Your Web App Config
1. **Project Settings** (⚙️ gear icon) → **General** → **Your apps**
2. Click **Add app** → choose **Web** (`</>`)
3. Register your app, then copy the `firebaseConfig` object

### Step 5 — Paste Config into the Frontend
Open `frontend/src/firebase.js` and replace:
```js
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",           // ← paste your values here
  authDomain: "...",
  projectId: "...",
  ...
};
```

### Step 6 — Get Service Account (for Flask backend)
1. **Project Settings** → **Service Accounts**
2. Click **Generate new private key** → download JSON
3. Rename it to `serviceAccountKey.json`
4. Place it in `backend/config/serviceAccountKey.json`

---

## 🚀 Running the App

### Frontend (React)
```bash
cd frontend
npm run dev
```
Opens at **http://localhost:5173**

### Backend (Flask)
```bash
cd backend
pip install -r requirements.txt
python app.py
```
Runs at **http://localhost:5000**

> ⚠️ The frontend works standalone (Firebase Auth + Firestore are direct).
> The Flask backend is needed for Phase 2 features (attendance, reports, etc.)

---

## 📁 Project Structure

```
scratch/
├── frontend/               # React + Tailwind + Firebase SDK
│   └── src/
│       ├── firebase.js          ← ⚠️ add your config here
│       ├── contexts/AuthContext.jsx
│       ├── pages/
│       │   ├── Login.jsx
│       │   ├── Register.jsx
│       │   ├── TeacherDashboard.jsx
│       │   └── StudentDashboard.jsx
│       └── components/
│           ├── Sidebar.jsx
│           └── ProtectedRoute.jsx
└── backend/                # Flask API
    ├── app.py
    ├── requirements.txt
    └── config/
        ├── firebase_config.py
        └── serviceAccountKey.json  ← ⚠️ download from Firebase Console
```

---

## 🗃️ Firestore Data Model

```
users/{uid}
  ├── name: string
  ├── email: string
  ├── role: "teacher" | "student"
  ├── rollNumber: string      (student only)
  ├── section: string         (student only)
  └── attendance: number      (student only — placeholder: 85)
```

---

## 🔮 Phase 2 (Coming Next)
- [ ] QR Code-based attendance marking
- [ ] Face recognition attendance
- [ ] Wi-Fi proximity detection
- [ ] Real attendance tracking + analytics
- [ ] Timetable CRUD for teachers
- [ ] Free period task assignments
- [ ] Student career goal tracker
