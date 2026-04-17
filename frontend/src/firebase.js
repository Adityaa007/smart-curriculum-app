// ============================================================
//  Firebase Client Configuration — PLACEHOLDER
// ============================================================
//  STEP 1: Go to https://console.firebase.google.com
//  STEP 2: Open your project → Project Settings → General
//  STEP 3: Scroll to "Your apps" → Add a Web App (if not done)
//  STEP 4: Copy the firebaseConfig object and paste it below
//  STEP 5: In Firebase Console → Authentication → Sign-in method
//          → Enable "Email/Password"
//  STEP 6: In Firebase Console → Firestore Database
//          → Create database → Start in test mode
// ============================================================

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBwV5-x7KXPe29vIMdAcFGdB7-d99cA6k8",
  authDomain: "smart-curriculum-d6f10.firebaseapp.com",
  projectId: "smart-curriculum-d6f10",
  storageBucket: "smart-curriculum-d6f10.firebasestorage.app",
  messagingSenderId: "704214313091",
  appId: "1:704214313091:web:fc35873517a49ca4a193b6",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
