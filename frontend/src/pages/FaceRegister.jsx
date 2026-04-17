import useTitle from "../hooks/useTitle";
import React, { useState, useEffect, useRef, useCallback } from "react";
import * as faceapi from "face-api.js";
import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  setDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { Camera, ChevronDown, ChevronLeft, Check, X, Users, RefreshCw, AlertCircle } from "lucide-react";

/* ── Dropdown ──────────────────────────────────────────────────── */
function Select({ id, label, value, onChange, options, placeholder, disabled }) {
  return (
    <div>
      {label && <label className="block text-xs text-slate-400 mb-1.5">{label}</label>}
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className="input-dark appearance-none pr-9"
          style={{ cursor: disabled ? "not-allowed" : "pointer" }}
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o.value ?? o} value={o.value ?? o}>
              {o.label ?? o}
            </option>
          ))}
        </select>
        <ChevronDown
          size={15}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
        />
      </div>
    </div>
  );
}

/* ── Model Loader ──────────────────────────────────────────────── */
function useLoadModels() {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("Initializing…");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        console.log("[FaceRegister] Starting model load...");
        setProgress("Loading face detection model…");
        await faceapi.nets.ssdMobilenetv1.loadFromUri("/models");
        if (cancelled) return;
        setProgress("Loading landmark model…");
        await faceapi.nets.faceLandmark68Net.loadFromUri("/models");
        if (cancelled) return;
        setProgress("Loading recognition model…");
        await faceapi.nets.faceRecognitionNet.loadFromUri("/models");
        if (cancelled) return;
        setLoaded(true);
      } catch (e) {
        console.error("[FaceRegister] Model load error:", e);
        if (!cancelled) setError(`Failed to load models: ${e.message}`);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return { loaded, error, progress };
}

/* ── Webcam Capture Component ──────────────────────────────────── */
function WebcamCapture({ onCapture, capturedCount, maxCaptures, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animRef = useRef(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [camError, setCamError] = useState("");
  const [capturing, setCapturing] = useState(false);

  // Start webcam
  useEffect(() => {
    let cancelled = false;
    async function startCam() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (e) {
        if (!cancelled) {
          if (e.name === "NotAllowedError") {
            setCamError("Camera access was denied. Please allow camera permissions in your browser settings and try again.");
          } else {
            setCamError(`Camera error: ${e.message}`);
          }
        }
      }
    }
    startCam();
    return () => {
      cancelled = true;
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  // Face detection loop
  useEffect(() => {
    if (!faceapi || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    async function detect() {
      if (video.readyState !== 4) {
        animRef.current = requestAnimationFrame(detect);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const detections = await faceapi.detectAllFaces(video).withFaceLandmarks();
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (detections.length > 0) {
        setFaceDetected(true);
        detections.forEach((det) => {
          const { x, y, width, height } = det.detection.box;
          ctx.strokeStyle = "#10b981";
          ctx.lineWidth = 3;
          ctx.strokeRect(x, y, width, height);

          // Corner accents
          const cl = 15;
          ctx.lineWidth = 4;
          ctx.strokeStyle = "#34d399";
          // top-left
          ctx.beginPath(); ctx.moveTo(x, y + cl); ctx.lineTo(x, y); ctx.lineTo(x + cl, y); ctx.stroke();
          // top-right
          ctx.beginPath(); ctx.moveTo(x + width - cl, y); ctx.lineTo(x + width, y); ctx.lineTo(x + width, y + cl); ctx.stroke();
          // bottom-left
          ctx.beginPath(); ctx.moveTo(x, y + height - cl); ctx.lineTo(x, y + height); ctx.lineTo(x + cl, y + height); ctx.stroke();
          // bottom-right
          ctx.beginPath(); ctx.moveTo(x + width - cl, y + height); ctx.lineTo(x + width, y + height); ctx.lineTo(x + width, y + height - cl); ctx.stroke();
        });
      } else {
        setFaceDetected(false);
      }

      animRef.current = requestAnimationFrame(detect);
    }

    video.addEventListener("playing", () => {
      animRef.current = requestAnimationFrame(detect);
    });

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  async function handleCapture() {
    if (!videoRef.current || capturing) return;
    setCapturing(true);

    try {
      const detection = await faceapi
        .detectSingleFace(videoRef.current)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        setCapturing(false);
        return;
      }

      // Convert Float32Array to regular array for Firestore
      const descriptor = Array.from(detection.descriptor);
      onCapture(descriptor);
    } catch (e) {
      console.error("Capture error:", e);
    }
    setCapturing(false);
  }

  if (camError) {
    return (
      <div className="glass-card p-6 flex flex-col items-center gap-4 text-center">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}
        >
          <AlertCircle size={28} className="text-red-400" />
        </div>
        <p className="text-red-300 font-semibold">Camera Access Denied</p>
        <p className="text-sm text-slate-400 max-w-sm">{camError}</p>
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Webcam + overlay */}
      <div className="webcam-container glass-card overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ width: "100%", display: "block", transform: "scaleX(-1)" }}
        />
        <canvas
          ref={canvasRef}
          className="face-overlay-canvas"
          style={{ transform: "scaleX(-1)" }}
        />

        {/* Face detection indicator */}
        <div
          className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold"
          style={{
            background: faceDetected ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)",
            border: `1px solid ${faceDetected ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.4)"}`,
            color: faceDetected ? "#34d399" : "#f87171",
            backdropFilter: "blur(8px)",
          }}
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{
              background: faceDetected ? "#10b981" : "#ef4444",
              animation: faceDetected ? "pulse 1.5s infinite" : "none",
            }}
          />
          {faceDetected ? "Face Detected" : "No Face Detected"}
        </div>

        {/* Capture counter */}
        <div
          className="absolute top-4 right-4 px-3 py-1.5 rounded-xl text-xs font-bold"
          style={{
            background: "rgba(99,102,241,0.2)",
            border: "1px solid rgba(99,102,241,0.4)",
            color: "#a78bfa",
            backdropFilter: "blur(8px)",
          }}
        >
          {capturedCount} / {maxCaptures} captured
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={onClose}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors flex items-center gap-2"
        >
          <X size={16} /> Cancel
        </button>

        <button
          onClick={handleCapture}
          disabled={!faceDetected || capturing || capturedCount >= maxCaptures}
          className="capture-btn"
          style={{ opacity: !faceDetected || capturing || capturedCount >= maxCaptures ? 0.4 : 1 }}
        >
          <Camera size={20} />
          {capturing ? "Capturing…" : `Capture (${capturedCount}/${maxCaptures})`}
        </button>
      </div>
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────────────────── */
export default function FaceRegister() {
  useTitle("Face Registration");
  const { currentUser, userProfile } = useAuth();
  const { loaded: modelsLoaded, error: modelError, progress: modelProgress } = useLoadModels();

  const [timetableEntries, setEntries] = useState([]);
  const [ttLoading, setTtLoading] = useState(true);
  const [section, setSection] = useState("");
  const [students, setStudents] = useState([]);
  const [studLoading, setStudLoading] = useState(false);
  const [registeredMap, setRegisteredMap] = useState({});

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [descriptors, setDescriptors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  const MAX_CAPTURES = 5;

  // Fetch teacher timetable
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, "timetable"), where("teacherUid", "==", currentUser.uid));
    return onSnapshot(q, (snap) => {
      setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setTtLoading(false);
    });
  }, [currentUser]);

  const sections = [...new Set(timetableEntries.map((e) => e.section))].sort();

  // Fetch students for selected section
  useEffect(() => {
    if (!section) { setStudents([]); return; }
    setStudLoading(true);
    const q = query(collection(db, "users"), where("role", "==", "student"), where("section", "==", section));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
      list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setStudents(list);
      setStudLoading(false);
    });
    return unsub;
  }, [section]);

  // Fetch which students already have face data
  useEffect(() => {
    if (!section) { setRegisteredMap({}); return; }
    const q = query(collection(db, "faceDescriptors"), where("section", "==", section));
    const unsub = onSnapshot(q, (snap) => {
      const map = {};
      snap.forEach((d) => {
        const data = d.data();
        map[data.studentId] = data.photoCount || 0;
      });
      setRegisteredMap(map);
    });
    return unsub;
  }, [section]);

  function handleSectionChange(e) {
    setSection(e.target.value);
    setSelectedStudent(null);
    setDescriptors([]);
    setMsg({ type: "", text: "" });
  }

  function handleSelectStudent(student) {
    setSelectedStudent(student);
    setDescriptors([]);
    setMsg({ type: "", text: "" });
  }

  function handleCapture(descriptor) {
    console.log("[FaceRegister] handleCapture called, descriptor length:", descriptor?.length);
    setDescriptors((prev) => {
      const next = [...prev, descriptor];
      console.log("[FaceRegister] Total captures now:", next.length);
      return next;
    });
  }

  async function handleSave() {
    console.log("[FaceRegister] handleSave called!");
    console.log("[FaceRegister] selectedStudent:", selectedStudent?.name, selectedStudent?.uid);
    console.log("[FaceRegister] descriptors.length:", descriptors.length);
    console.log("[FaceRegister] currentUser:", currentUser?.uid ?? "NULL — this is the problem!");
    console.log("[FaceRegister] saving state:", saving);

    if (!selectedStudent) {
      console.error("[FaceRegister] BLOCKED: selectedStudent is null");
      return;
    }
    if (descriptors.length === 0) {
      console.error("[FaceRegister] BLOCKED: no descriptors captured");
      return;
    }
    if (!currentUser) {
      console.error("[FaceRegister] BLOCKED: currentUser is null — not logged in?");
      setMsg({ type: "error", text: "You are not logged in. Please refresh and log in again." });
      return;
    }

    setSaving(true);
    setMsg({ type: "", text: "" });

    try {
      // ✔️ Firestore does NOT support nested arrays (array-of-arrays).
      // Convert each descriptor (plain number[]) to { values: number[] } objects.
      // This stores them as an array of objects, which Firestore supports fine.
      const firestoreDescriptors = descriptors.map((d, i) => {
        const arr = Array.isArray(d) ? d : Array.from(d);
        console.log(`[FaceRegister] Descriptor ${i + 1}: ${arr.length} values, type=${typeof arr[0]}`);
        return { values: arr };
      });

      console.log("[FaceRegister] Writing to Firestore: faceDescriptors /", selectedStudent.uid);
      await setDoc(doc(db, "faceDescriptors", selectedStudent.uid), {
        studentId: selectedStudent.uid,
        studentName: selectedStudent.name || "Student",
        section,
        descriptors: firestoreDescriptors,   // [ { values: [...128 floats] }, ... ]
        registeredBy: currentUser.uid,
        registeredAt: serverTimestamp(),
        photoCount: descriptors.length,
      });

      console.log("[FaceRegister] ✓ Save successful!");
      setMsg({ type: "success", text: `Face data saved for ${selectedStudent.name} (${descriptors.length} captures)` });
      setSelectedStudent(null);
      setDescriptors([]);
    } catch (e) {
      console.error("[FaceRegister] Save failed:", e.code, e.message);
      setMsg({ type: "error", text: `Save failed: ${e.message}` });
    } finally {
      setSaving(false);
    }
  }

  // ── Loading / Error States ──
  if (modelError) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="glass-card p-8 flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}>
            <AlertCircle size={28} className="text-red-400" />
          </div>
          <p className="text-red-300 font-semibold">Model Loading Error</p>
          <p className="text-sm text-slate-400">{modelError}</p>
        </div>
      </div>
    );
  }

  if (!modelsLoaded) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="glass-card p-8 flex flex-col items-center gap-4 text-center">
          <div className="model-loading-spinner" />
          <p className="text-slate-200 font-semibold">Loading Face Recognition Models</p>
          <p className="text-sm text-slate-400">{modelProgress}</p>
          <p className="text-xs text-slate-500">This may take a few seconds on first load…</p>
        </div>
      </div>
    );
  }

  // ── Active Capture Mode ──
  if (selectedStudent) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-100">
            Register Face — <span className="gradient-text">{selectedStudent.name}</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Capture {MAX_CAPTURES} photos from different angles for best accuracy
          </p>
        </div>

        <WebcamCapture
          onCapture={handleCapture}
          capturedCount={descriptors.length}
          maxCaptures={MAX_CAPTURES}
          onClose={() => { setSelectedStudent(null); setDescriptors([]); }}
        />

        {/* Save section */}
        {descriptors.length >= 3 && (
          <div className="glass-card p-4 mt-4 flex items-center justify-between animate-slide-up">
            <div>
              <p className="text-sm text-emerald-400 flex items-center gap-1.5">
                <Check size={16} /> {descriptors.length} face{descriptors.length > 1 ? "s" : ""} captured
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {descriptors.length < MAX_CAPTURES ? `You can capture ${MAX_CAPTURES - descriptors.length} more for better accuracy` : "Maximum captures reached — ready to save!"}
              </p>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary flex items-center gap-2"
              style={{ width: "auto", padding: "0.6rem 1.5rem", opacity: saving ? 0.6 : 1 }}
            >
              {saving ? "Saving…" : "Save Face Data"}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Student Selection Mode ──
  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="badge bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">Face Setup</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-100">Register Student Faces</h1>
        <p className="text-slate-400 text-sm mt-1">
          Capture face photos for each student to enable face recognition attendance
        </p>
      </div>

      {/* Messages */}
      {msg.text && (
        <div
          className={`mb-4 px-4 py-3 rounded-xl text-sm flex items-center gap-2 animate-slide-up ${
            msg.type === "success"
              ? "text-emerald-300 bg-emerald-500/10 border border-emerald-500/20"
              : "text-red-300 bg-red-500/10 border border-red-500/20"
          }`}
        >
          {msg.type === "success" ? <Check size={16} /> : <AlertCircle size={16} />}
          {msg.text}
        </div>
      )}

      {/* Section Selector */}
      <div className="glass-card p-6 mb-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)" }}>
            <Camera size={20} className="text-indigo-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-100">Select Section</p>
            <p className="text-xs text-slate-400">Choose a section to view and register student faces</p>
          </div>
        </div>

        {ttLoading ? (
          <p className="text-sm text-slate-500 py-2">Loading your timetable…</p>
        ) : (
          <Select
            id="fr-section"
            label="Section"
            value={section}
            onChange={handleSectionChange}
            options={sections}
            placeholder="— Select section —"
          />
        )}
      </div>

      {/* Student List */}
      {section && (
        <div className="glass-card overflow-hidden animate-slide-up">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <Users size={15} className="text-slate-400" />
              <span className="text-sm font-semibold text-slate-200">
                {studLoading ? "Loading students…" : `${students.length} student${students.length !== 1 ? "s" : ""} in ${section}`}
              </span>
            </div>
            <span className="text-xs text-slate-500">
              {Object.keys(registeredMap).length} / {students.length} registered
            </span>
          </div>

          {studLoading ? (
            <div className="py-8 text-center text-sm text-slate-500">Loading…</div>
          ) : students.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">No students found in this section.</div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {students.map((s, idx) => {
                const isRegistered = !!registeredMap[s.uid];
                const photoCount = registeredMap[s.uid] || 0;

                return (
                  <div
                    key={s.uid}
                    className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs text-slate-600 w-6 shrink-0">{idx + 1}.</span>
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white"
                        style={{
                          background: isRegistered
                            ? "rgba(16,185,129,0.25)"
                            : "rgba(99,102,241,0.2)",
                        }}
                      >
                        {s.name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-200 truncate">{s.name}</p>
                        <div className="flex items-center gap-2">
                          {s.rollNumber && (
                            <span className="text-xs text-slate-500 truncate">{s.rollNumber}</span>
                          )}
                          {isRegistered && (
                            <span className="face-badge-recognized">
                              <Check size={10} /> {photoCount} photos
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleSelectStudent(s)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all duration-150"
                      style={
                        isRegistered
                          ? {
                              background: "rgba(16,185,129,0.1)",
                              border: "1px solid rgba(16,185,129,0.25)",
                              color: "#34d399",
                            }
                          : {
                              background: "rgba(99,102,241,0.1)",
                              border: "1px solid rgba(99,102,241,0.25)",
                              color: "#a78bfa",
                            }
                      }
                    >
                      <Camera size={13} />
                      {isRegistered ? "Re-register" : "Register Face"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
