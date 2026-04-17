import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { QrCode, CheckCircle, AlertCircle, X } from "lucide-react";

// ── Status Card ───────────────────────────────────────────────────────────────
function StatusCard({ type, message }) {
  const styles = {
    success: {
      bg: "rgba(16,185,129,0.1)",
      border: "rgba(16,185,129,0.25)",
      text: "#34d399",
      Icon: CheckCircle,
    },
    error: {
      bg: "rgba(239,68,68,0.1)",
      border: "rgba(239,68,68,0.25)",
      text: "#f87171",
      Icon: AlertCircle,
    },
    warning: {
      bg: "rgba(245,158,11,0.1)",
      border: "rgba(245,158,11,0.25)",
      text: "#fbbf24",
      Icon: AlertCircle,
    },
  };
  const s = styles[type] || styles.error;
  return (
    <div
      className="flex items-start gap-3 rounded-xl px-4 py-3.5"
      style={{ background: s.bg, border: `1px solid ${s.border}` }}
    >
      <s.Icon size={18} style={{ color: s.text, marginTop: "1px", flexShrink: 0 }} />
      <p className="text-sm font-medium" style={{ color: s.text }}>{message}</p>
    </div>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────
export default function ScanQR() {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const [scanning, setScanning]   = useState(false);
  const [status, setStatus]       = useState(null); // { type, message }
  const [processing, setProcessing] = useState(false);

  const scannerRef = useRef(null);
  const html5QrRef = useRef(null);
  const isScannerRunning = useRef(false);

  // Use refs so the html5-qrcode callback always sees the latest values
  const processingRef = useRef(false);
  const handleQRScanRef = useRef(null);

  // Keep refs in sync with state
  useEffect(() => { processingRef.current = processing; }, [processing]);

  // ── Start webcam scanner ─────────────────────────────────────────────────
  async function startScanner() {
    setStatus(null);
    setScanning(true);
  }

  // ── Stop scanner ─────────────────────────────────────────────────────────
  async function stopScanner() {
    if (html5QrRef.current && isScannerRunning.current) {
      try {
        await html5QrRef.current.stop();
        html5QrRef.current.clear();
      } catch (e) {
        console.warn("[QR] Stop error:", e);
      }
      isScannerRunning.current = false;
    }
    html5QrRef.current = null;
    setScanning(false);
  }

  // ── Process scanned QR ────────────────────────────────────────────────────
  async function handleQRScan(rawText) {
    // Guard against duplicate calls
    if (processingRef.current) {
      console.log("[QR] Already processing, skipping duplicate scan");
      return;
    }
    processingRef.current = true;
    setProcessing(true);

    console.log("[QR] ✓ Scan detected! Raw value:", rawText);

    // Stop scanner immediately
    await stopScanner();

    let payload;
    try {
      payload = JSON.parse(rawText);
      console.log("[QR] Parsed payload:", payload);
    } catch {
      console.error("[QR] Failed to parse QR code as JSON:", rawText);
      setStatus({ type: "error", message: "Invalid QR code format. Please scan a valid class QR code." });
      processingRef.current = false;
      setProcessing(false);
      return;
    }

    const { sessionId, subject, section, expiryTime, teacherId } = payload;

    // Validate required fields
    if (!sessionId) {
      console.error("[QR] Missing sessionId in payload");
      setStatus({ type: "error", message: "Invalid QR code — missing session information." });
      processingRef.current = false;
      setProcessing(false);
      return;
    }

    // 1. Check expiry
    if (expiryTime && new Date() > new Date(expiryTime)) {
      console.warn("[QR] QR code expired:", expiryTime);
      setStatus({ type: "error", message: "This QR code has expired. Ask your teacher to generate a new one." });
      processingRef.current = false;
      setProcessing(false);
      return;
    }

    // 2. Check already marked & save attendance
    try {
      const existing = await getDocs(
        query(
          collection(db, "attendance"),
          where("sessionId", "==", sessionId),
          where("studentId", "==", currentUser.uid)
        )
      );
      if (!existing.empty) {
        console.log("[QR] Already marked for this session");
        setStatus({ type: "warning", message: "You have already marked attendance for this class." });
        processingRef.current = false;
        setProcessing(false);
        return;
      }

      // 3. Save attendance
      const now = new Date();
      console.log("[QR] Saving attendance record...");
      await addDoc(collection(db, "attendance"), {
        studentId:   currentUser.uid,
        studentName: userProfile?.name || "Student",
        rollNumber:  userProfile?.rollNumber || "",
        subject:     subject || "Unknown",
        section:     section || "",
        date:        now.toLocaleDateString("en-IN"),
        timestamp:   now.toISOString(),
        sessionId,
        teacherId:   teacherId || null,
        method:      "QR",
        status:      "present",
        markedBy:    currentUser.uid,
        markedByName: userProfile?.name || "Student",
        createdAt:   serverTimestamp(),
      });

      console.log("[QR] ✓ Attendance saved successfully!");
      setStatus({ type: "success", message: `Attendance marked successfully! ✓  ${subject || "Class"} · Section ${section || ""}` });
      setTimeout(() => navigate("/student"), 2000);
    } catch (err) {
      console.error("[QR] Firebase error:", err);
      setStatus({ type: "error", message: `Failed to save attendance: ${err.message}` });
    }

    processingRef.current = false;
    setProcessing(false);
  }

  // Store latest handleQRScan in ref so the scanner callback always calls the current version
  handleQRScanRef.current = handleQRScan;

  // Mount / unmount the scanner when `scanning` changes
  useEffect(() => {
    if (!scanning) return;

    const scanner = new Html5Qrcode("qr-reader");
    html5QrRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: window.innerWidth < 768 ? 200 : 260, height: window.innerWidth < 768 ? 200 : 260 }, aspectRatio: window.innerWidth < 768 ? 1 : 1.333334 },
        (decodedText) => {
          // Use refs to always get the latest function and processing state
          if (processingRef.current) return;
          console.log("[QR] html5-qrcode callback fired, decoded:", decodedText);
          if (handleQRScanRef.current) {
            handleQRScanRef.current(decodedText);
          }
        },
        () => {} // silent on-frame errors (fires every frame without detection)
      )
      .then(() => {
        isScannerRunning.current = true;
        console.log("[QR] Scanner started successfully");
      })
      .catch((err) => {
        console.error("[QR] Camera error:", err);
        const msg = typeof err === "string" && err.includes("NotAllowedError")
          ? "Camera access was denied. Please allow camera permission in your browser settings."
          : "Could not access camera. Please allow camera permission and try again.";
        setStatus({ type: "error", message: msg });
        setScanning(false);
      });

    return () => {
      if (html5QrRef.current && isScannerRunning.current) {
        html5QrRef.current
          .stop()
          .then(() => {
            if (html5QrRef.current) html5QrRef.current.clear();
          })
          .catch(() => {});
        isScannerRunning.current = false;
      }
    };
  }, [scanning]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100">Scan QR to Attend</h1>
        <p className="text-slate-400 text-sm mt-1">
          Point your camera at the QR code shown by your teacher
        </p>
      </div>

      {/* Result message */}
      {status && (
        <div className="mb-6">
          <StatusCard type={status.type} message={status.message} />
          {status.type === "success" ? (
            <div className="mt-4 flex items-center justify-between px-1">
              <span className="text-xs text-slate-400 animate-pulse">Redirecting to dashboard...</span>
              <button
                onClick={() => navigate("/student")}
                className="btn-primary"
                style={{ padding: "0.5rem 1.25rem", width: "auto" }}
              >
                Go to Dashboard →
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setStatus(null); }}
              className="mt-4 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              ← Scan another code
            </button>
          )}
        </div>
      )}

      {/* Scanner or start button */}
      {!status && (
        <>
          {/* QR reader container — always in DOM when scanning=true */}
          <div
            className="glass-card overflow-hidden mb-5"
            style={{ display: scanning ? "block" : "none" }}
          >
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs text-slate-300 font-medium">Camera Active</span>
              </div>
              <button
                onClick={stopScanner}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                title="Stop scanner"
              >
                <X size={16} />
              </button>
            </div>

            {/* The HTML element html5-qrcode attaches to */}
            <div id="qr-reader" className="w-full" />

            <p className="text-xs text-slate-500 text-center py-3 px-4">
              Align the QR code inside the viewfinder
            </p>
          </div>

          {/* Start button */}
          {!scanning && (
            <div className="glass-card p-8 flex flex-col items-center gap-4 text-center">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)" }}
              >
                <QrCode size={36} className="text-indigo-400" />
              </div>
              <div>
                <p className="text-slate-200 font-semibold">Ready to scan?</p>
                <p className="text-sm text-slate-400 mt-1">
                  Make sure your teacher has an active QR session on screen
                </p>
              </div>
              <button
                id="sq-scan-btn"
                onClick={startScanner}
                className="btn-primary"
                style={{ width: "auto", padding: "0.7rem 2rem" }}
              >
                Open Camera & Scan
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
