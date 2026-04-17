import { useState, useEffect, useRef } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import API_BASE from "../lib/api";


const POLL_INTERVAL = 30000; // 30 seconds

/**
 * useWifiAttendance — Background Wi-Fi proximity polling hook.
 *
 * Runs silently on the student side. When an active attendance session exists
 * for the student's section, it polls the backend every 30 seconds to check
 * if the student's IP is on the college network.
 *
 * Returns: { wifiStatus: 'idle' | 'checking' | 'verified' | 'not-on-network' | 'error', wifiMessage: string }
 */
export default function useWifiAttendance() {
  const { currentUser, userProfile } = useAuth();
  const [wifiStatus, setWifiStatus] = useState("idle"); // idle, checking, verified, not-on-network, error
  const [wifiMessage, setWifiMessage] = useState("");
  const [activeSession, setActiveSession] = useState(null);
  const intervalRef = useRef(null);
  const verifiedRef = useRef(false);

  // 1. Listen for any active attendance session for the student's section
  useEffect(() => {
    if (!userProfile?.section) return;

    // Listen for face attendance sessions
    const q = query(
      collection(db, "faceAttendanceSessions"),
      where("section", "==", userProfile.section),
      where("status", "==", "active")
    );

    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const sessionDoc = snap.docs[0];
        setActiveSession({ id: sessionDoc.id, ...sessionDoc.data() });
      } else {
        setActiveSession(null);
        setWifiStatus("idle");
        setWifiMessage("");
        verifiedRef.current = false;
      }
    });

    return unsub;
  }, [userProfile?.section]);

  // 2. Poll the backend when session is active
  useEffect(() => {
    if (!activeSession || !currentUser || verifiedRef.current) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    async function checkNetwork() {
      // Skip if already verified
      if (verifiedRef.current) return;

      try {
        setWifiStatus("checking");
        const resp = await fetch(`${API_BASE}/api/verify-network`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId: currentUser.uid,
            sessionId: activeSession.sessionId,
          }),
        });

        if (!resp.ok) {
          // Backend unreachable or error — fail silently
          console.warn("[WiFi] Backend returned non-OK:", resp.status);
          setWifiStatus("error");
          setWifiMessage("Network check unavailable");
          return;
        }

        const data = await resp.json();

        if (data.verified) {
          verifiedRef.current = true;
          setWifiStatus("verified");
          setWifiMessage(data.message || "Location verified automatically");

          // Check already marked to avoid duplicates
          const existingQ = query(
            collection(db, "attendance"),
            where("sessionId", "==", activeSession.sessionId),
            where("studentId", "==", currentUser.uid)
          );
          const existingSnap = await getDocs(existingQ);

          if (existingSnap.empty) {
            // Mark attendance
            const now = new Date();
            await addDoc(collection(db, "attendance"), {
              studentId: currentUser.uid,
              studentName: userProfile?.name || "Student",
              rollNumber: userProfile?.rollNumber || "",
              subject: activeSession.subject,
              section: activeSession.section,
              date: now.toLocaleDateString("en-IN"),
              timestamp: now.toISOString(),
              sessionId: activeSession.sessionId,
              teacherId: activeSession.teacherId,
              method: "wifi",
              status: "present",
              markedBy: "system",
              markedByName: "Wi-Fi Auto",
              wifiVerified: true,
              wifiTimestamp: now.toISOString(),
              studentIp: data.studentIp || "unknown",
              createdAt: serverTimestamp(),
            });
            console.log("[WiFi] ✓ Attendance marked via Wi-Fi");
          } else {
            // Already marked (by QR or face) — just add the Wi-Fi verified flag
            // We don't update existing records to avoid conflicts, just log it
            console.log("[WiFi] Attendance already exists for this session");
          }

          // Stop polling
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        } else {
          setWifiStatus("not-on-network");
          setWifiMessage(data.message || "Not detected on campus network");
        }
      } catch (e) {
        // Network error (backend down) — fail silently
        console.warn("[WiFi] Network check failed:", e.message);
        setWifiStatus("error");
        setWifiMessage("Network check unavailable");
      }
    }

    // Run immediately, then every 30 seconds
    checkNetwork();
    intervalRef.current = setInterval(checkNetwork, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [activeSession, currentUser, userProfile]);

  return { wifiStatus, wifiMessage };
}
