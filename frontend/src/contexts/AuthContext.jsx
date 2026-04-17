import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Transient null guard ──────────────────────────────────────────────────
  // Firebase sometimes fires onAuthStateChanged with null during token refresh
  // or SDK initialization, then immediately fires again with the real user.
  // We use a debounce: if we've already seen a valid user and then receive null,
  // we wait 600ms before acting on it — if a real user fires within that window,
  // we cancel the null and keep the profile intact.
  const nullTimerRef = useRef(null);
  const hasSeenUser = useRef(false); // true once we've seen any non-null user

  // Load profile from Firestore for the signed-in user
  async function fetchProfile(user) {
    if (!user) {
      console.log("[Auth] fetchProfile: no user — clearing profile");
      setCurrentUser(null);
      setUserProfile(null);
      setLoading(false);
      return;
    }
    console.log("[Auth] Fetching Firestore profile for uid:", user.uid);
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        const data = snap.data();
        console.log("[Auth] Profile loaded. Role:", data.role);
        setCurrentUser(user);
        setUserProfile(data);
      } else {
        // User exists in Firebase Auth but has NO Firestore document.
        console.warn("[Auth] No Firestore document for uid:", user.uid);
        setCurrentUser(user);
        setUserProfile({ role: null, _noDocument: true });
      }
    } catch (err) {
      console.error("[Auth] Error fetching profile:", err.message);
      setCurrentUser(user);
      setUserProfile(null);
    }
    setLoading(false);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("[Auth] onAuthStateChanged fired. User:", user?.email ?? "null");

      // Clear any pending null timer — a new event has arrived
      if (nullTimerRef.current) {
        clearTimeout(nullTimerRef.current);
        nullTimerRef.current = null;
      }

      if (user) {
        // Real user — act immediately
        hasSeenUser.current = true;
        fetchProfile(user);
      } else {
        // Null received.
        if (!hasSeenUser.current) {
          // We haven't seen a real user yet — this is the initial "not logged in" state.
          // Act immediately: user is genuinely not logged in.
          console.log("[Auth] Initial null — user not logged in");
          setCurrentUser(null);
          setUserProfile(null);
          setLoading(false);
        } else {
          // We've seen a real user before. This null might be transient (token refresh).
          // Wait 600ms — if a real user fires within that window, we ignore this null.
          console.warn("[Auth] Transient null detected — waiting 600ms before clearing...");
          nullTimerRef.current = setTimeout(() => {
            console.log("[Auth] Null confirmed after 600ms — clearing user (real logout)");
            hasSeenUser.current = false;
            fetchProfile(null);
          }, 600);
        }
      }
    });

    return () => {
      unsubscribe();
      if (nullTimerRef.current) clearTimeout(nullTimerRef.current);
    };
  }, []);

  // Register new user + save profile to Firestore
  async function register({ name, email, password, role, rollNumber, section }) {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = credential.user.uid;

    const profile = {
      name,
      email,
      role,
      createdAt: serverTimestamp(),
    };

    if (role === "student") {
      profile.rollNumber = rollNumber || "";
      profile.section = section || "";
      profile.attendance = 85;
    }

    await setDoc(doc(db, "users", uid), profile);
    setUserProfile(profile);
    return credential;
  }

  // Login existing user
  async function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  // Logout — intentional, so immediately clear state
  async function logout() {
    hasSeenUser.current = false;
    if (nullTimerRef.current) clearTimeout(nullTimerRef.current);
    setUserProfile(null);
    setCurrentUser(null);
    return signOut(auth);
  }

  const value = {
    currentUser,
    userProfile,
    loading,
    register,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
