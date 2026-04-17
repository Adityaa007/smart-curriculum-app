import useTitle from "../hooks/useTitle";
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import * as faceapi from "face-api.js";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { Camera, CheckCircle, AlertCircle, X } from "lucide-react";

/* ── Status Card ───────────────────────────────────────────────── */
function StatusCard({ type, message }) {
  const styles = {
    success: {
      bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.25)", text: "#34d399",
      Icon: CheckCircle,
    },
    error: {
      bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.25)", text: "#f87171",
      Icon: AlertCircle,
    },
    warning: {
      bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.25)", text: "#fbbf24",
      Icon: AlertCircle,
    },
  };
  const s = styles[type] || styles.error;
  return (
    <div className="flex items-start gap-3 rounded-xl px-4 py-3.5"
      style={{ background: s.bg, border: `1px solid ${s.border}` }}>
      <s.Icon size={18} style={{ color: s.text, marginTop: "1px", flexShrink: 0 }} />
      <p className="text-sm font-medium" style={{ color: s.text }}>{message}</p>
    </div>
  );
}

/* ── Main Export ───────────────────────────────────────────────── */
export default function ScanFace() {
  useTitle("Scan Face");
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();

  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelProgress, setModelProgress] = useState("Initializing…");
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState(null); // { type, message }
  const [processing, setProcessing] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [activeSession, setActiveSession] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animRef = useRef(null);
  const MAX_ATTEMPTS = 3;

  // ── Find active face session for this student's section ──
  useEffect(() => {
    async function findSession() {
      if (!userProfile?.section) { setSessionLoading(false); return; }
      try {
        const q = query(
          collection(db, "faceAttendanceSessions"),
          where("section", "==", userProfile.section),
          where("status", "==", "active")
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const sessionDoc = snap.docs[0];
          setActiveSession({ id: sessionDoc.id, ...sessionDoc.data() });
        }
      } catch (e) {
        console.error("Error finding session:", e);
      }
      setSessionLoading(false);
    }
    findSession();
  }, [userProfile]);

  // ── Load face-api.js models ──
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        console.log("[ScanFace] Loading models...");
        setModelProgress("Loading face detection model…");
        await faceapi.nets.ssdMobilenetv1.loadFromUri("/models");
        if (cancelled) return;
        setModelProgress("Loading landmark model…");
        await faceapi.nets.faceLandmark68Net.loadFromUri("/models");
        if (cancelled) return;
        setModelProgress("Loading recognition model…");
        await faceapi.nets.faceRecognitionNet.loadFromUri("/models");
        if (cancelled) return;
        console.log("[ScanFace] Models loaded successfully");
        setModelsLoaded(true);
      } catch (e) {
        console.error("[ScanFace] Model load error:", e);
        setStatus({ type: "error", message: `Failed to load face recognition models: ${e.message}` });
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // ── Start webcam ──
  async function startScanning() {
    setStatus(null);
    setAttempts(0);
    setScanning(true);
  }

  // Mount camera when scanning starts
  useEffect(() => {
    if (!scanning) return;

    let cancelled = false;
    async function startCam() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (e) {
        if (!cancelled) {
          const msg = e.name === "NotAllowedError"
            ? "Camera access was denied. Please allow camera permissions in your browser settings."
            : `Camera error: ${e.message}`;
          setStatus({ type: "error", message: msg });
          setScanning(false);
        }
      }
    }
    startCam();

    return () => {
      cancelled = true;
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [scanning]);

  // Face detection overlay loop
  useEffect(() => {
    if (!scanning || !modelsLoaded || !videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    let running = true;

    async function detect() {
      if (!running || video.readyState !== 4) {
        if (running) animRef.current = requestAnimationFrame(detect);
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const detections = await faceapi.detectAllFaces(video).withFaceLandmarks();
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      detections.forEach((det) => {
        const { x, y, width, height } = det.detection.box;
        ctx.strokeStyle = "#6366f1";
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, width, height);
        // Corner accents
        const cl = 15;
        ctx.lineWidth = 4;
        ctx.strokeStyle = "#a78bfa";
        ctx.beginPath(); ctx.moveTo(x, y + cl); ctx.lineTo(x, y); ctx.lineTo(x + cl, y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + width - cl, y); ctx.lineTo(x + width, y); ctx.lineTo(x + width, y + cl); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, y + height - cl); ctx.lineTo(x, y + height); ctx.lineTo(x + cl, y + height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + width - cl, y + height); ctx.lineTo(x + width, y + height); ctx.lineTo(x + width, y + height - cl); ctx.stroke();
      });

      await new Promise((r) => setTimeout(r, 100));
      if (running) animRef.current = requestAnimationFrame(detect);
    }

    function onPlaying() { animRef.current = requestAnimationFrame(detect); }
    video.addEventListener("playing", onPlaying);

    return () => {
      running = false;
      video.removeEventListener("playing", onPlaying);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [scanning, modelsLoaded]);

  // ── Stop scanner ──
  function stopScanner() {
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    if (animRef.current) cancelAnimationFrame(animRef.current);
    streamRef.current = null;
    setScanning(false);
  }

  // ── Verify face ──
  async function handleVerify() {
    if (processing || !videoRef.current || !activeSession) return;
    setProcessing(true);

    try {
      // 1. Load this student's own descriptors from Firebase
      const descDoc = await getDoc(doc(db, "faceDescriptors", currentUser.uid));
      if (!descDoc.exists()) {
        stopScanner();
        setStatus({ type: "error", message: "Your face is not registered yet. Please ask your teacher to register your face first." });
        setProcessing(false);
        return;
      }

      const savedDescriptors = descDoc.data().descriptors;
      if (!savedDescriptors || savedDescriptors.length === 0) {
        stopScanner();
        setStatus({ type: "error", message: "No face data found. Please ask your teacher to re-register your face." });
        setProcessing(false);
        return;
      }

      // 2. Detect face in video
      const detection = await faceapi
        .detectSingleFace(videoRef.current)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        if (newAttempts >= MAX_ATTEMPTS) {
          stopScanner();
          setStatus({ type: "error", message: "Face not detected after 3 attempts. Please ensure your face is clearly visible and well-lit, then try again." });
        } else {
          setStatus({ type: "warning", message: `No face detected. ${MAX_ATTEMPTS - newAttempts} attempt(s) remaining. Position your face in the frame.` });
        }
        setProcessing(false);
        return;
      }

      // 3. Compare against saved descriptors
      const currentDescriptor = detection.descriptor;
      let bestDistance = Infinity;

      console.log("[ScanFace] Comparing against", savedDescriptors.length, "saved descriptors");

      for (const saved of savedDescriptors) {
        // Handle both storage formats:
        // New format: { values: [128 numbers] }  ← after Firestore nested-array fix
        // Old format: [128 numbers]               ← legacy, pre-fix
        const rawArr = saved?.values ?? saved;
        const savedArr = new Float32Array(rawArr);
        const distance = faceapi.euclideanDistance(currentDescriptor, savedArr);
        if (distance < bestDistance) bestDistance = distance;
      }

      console.log("[ScanFace] Best distance:", bestDistance.toFixed(3), "| threshold: 0.5");

      const confidence = Math.round((1 - bestDistance) * 100);

      if (bestDistance < 0.5) {
        // Match! Mark attendance
        stopScanner();

        // Check already marked
        const existingQ = query(
          collection(db, "attendance"),
          where("sessionId", "==", activeSession.sessionId),
          where("studentId", "==", currentUser.uid)
        );
        const existing = await getDocs(existingQ);
        if (!existing.empty) {
          setStatus({ type: "warning", message: "You have already marked attendance for this session." });
          setProcessing(false);
          return;
        }

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
          method: "face",
          status: "present",
          markedBy: currentUser.uid,
          markedByName: userProfile?.name || "Student",
          confidence,
          createdAt: serverTimestamp(),
        });

        setStatus({
          type: "success",
          message: `Attendance marked successfully! ✓  ${activeSession.subject} · Section ${activeSession.section} · Confidence: ${confidence}%`,
        });
        setTimeout(() => navigate("/student"), 3000);
      } else {
        // No match
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        if (newAttempts >= MAX_ATTEMPTS) {
          stopScanner();
          setStatus({
            type: "error",
            message: "Face not matched after 3 attempts — please contact your teacher for manual attendance.",
          });
        } else {
          setStatus({
            type: "warning",
            message: `Face not matched (${confidence}% confidence). ${MAX_ATTEMPTS - newAttempts} attempt(s) remaining. Try better lighting or a different angle.`,
          });
        }
      }
    } catch (e) {
      console.error("Verify error:", e);
      setStatus({ type: "error", message: `Verification error: ${e.message}` });
    }

    setProcessing(false);
  }

  // ── No session active ──
  if (sessionLoading) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <div className="glass-card p-8 text-center">
          <div className="model-loading-spinner mx-auto mb-4" />
          <p className="text-slate-300 font-medium">Looking for active session…</p>
        </div>
      </div>
    );
  }

  if (!activeSession) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-100">Face Attendance</h1>
          <p className="text-slate-400 text-sm mt-1">Scan your face to mark attendance</p>
        </div>
        <div className="glass-card p-8 flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)" }}>
            <Camera size={28} className="text-amber-400" />
          </div>
          <p className="text-slate-200 font-semibold">No Active Session</p>
          <p className="text-sm text-slate-400 max-w-sm">
            There is no face attendance session active for your section right now. Please wait for your teacher to start one.
          </p>
          <button
            onClick={() => navigate("/student")}
            className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors mt-2"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── Models loading ──
  if (!modelsLoaded && !status) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-100">Face Attendance</h1>
          <p className="text-slate-400 text-sm mt-1">
            <strong className="text-emerald-400">{activeSession.subject}</strong> · Section {activeSession.section}
          </p>
        </div>
        <div className="glass-card p-8 flex flex-col items-center gap-4 text-center">
          <div className="model-loading-spinner" />
          <p className="text-slate-200 font-semibold">Loading Face Recognition</p>
          <p className="text-sm text-slate-400">{modelProgress}</p>
          <p className="text-xs text-slate-500">This may take a few seconds on first load…</p>
        </div>
      </div>
    );
  }

  // ── Main Render ──
  return (
    <div className="p-6 max-w-xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Face Attendance</h1>
        <p className="text-slate-400 text-sm mt-1">
          <strong className="text-emerald-400">{activeSession.subject}</strong> · Section {activeSession.section}
        </p>
      </div>

      {/* Status message */}
      {status && (
        <div className="mb-5 animate-slide-up">
          <StatusCard type={status.type} message={status.message} />
          {status.type === "success" ? (
            <div className="mt-4 flex items-center justify-between px-1">
              <span className="text-xs text-slate-400 animate-pulse">Redirecting to dashboard...</span>
              <button onClick={() => navigate("/student")} className="btn-primary"
                style={{ padding: "0.5rem 1.25rem", width: "auto" }}>
                Go to Dashboard →
              </button>
            </div>
          ) : status.type === "error" && attempts >= MAX_ATTEMPTS ? (
            <button onClick={() => navigate("/student")}
              className="mt-4 text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
              ← Back to Dashboard
            </button>
          ) : null}
        </div>
      )}

      {/* Scanner or start button */}
      {!status || (status.type === "warning" && attempts < MAX_ATTEMPTS) ? (
        <>
          {/* Camera view */}
          <div className="glass-card overflow-hidden mb-5"
            style={{ display: scanning ? "block" : "none" }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" style={{ animation: "pulse 1.5s infinite" }} />
                <span className="text-xs text-slate-300 font-medium">Camera Active</span>
              </div>
              <button onClick={stopScanner}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                title="Stop scanner">
                <X size={16} />
              </button>
            </div>

            <div className="webcam-container" style={{ aspectRatio: "4/3" }}>
              <video ref={videoRef} autoPlay playsInline muted
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", transform: "scaleX(-1)" }} />
              <canvas ref={canvasRef} className="face-overlay-canvas" style={{ transform: "scaleX(-1)" }} />
            </div>

            {/* Verify button */}
            <div className="p-4 flex flex-col items-center gap-3">
              <button
                onClick={handleVerify}
                disabled={processing}
                className="capture-btn w-full justify-center"
                style={{ opacity: processing ? 0.5 : 1, animation: processing ? "none" : undefined }}
              >
                <Camera size={20} />
                {processing ? "Verifying…" : "Verify My Face"}
              </button>
              {attempts > 0 && attempts < MAX_ATTEMPTS && (
                <p className="text-xs text-amber-400">{MAX_ATTEMPTS - attempts} attempt(s) remaining</p>
              )}
            </div>
          </div>

          {/* Start button (shown when not scanning) */}
          {!scanning && (!status || status.type !== "success") && (
            <div className="glass-card p-8 flex flex-col items-center gap-4 text-center">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)" }}>
                <Camera size={36} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-slate-200 font-semibold">Ready to scan?</p>
                <p className="text-sm text-slate-400 mt-1">
                  Your teacher has started a face attendance session. Open your camera and verify your identity.
                </p>
              </div>
              <button onClick={startScanning} className="btn-primary"
                style={{ width: "auto", padding: "0.7rem 2rem" }}>
                Open Camera & Scan My Face
              </button>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
