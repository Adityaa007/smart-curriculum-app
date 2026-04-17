import useTitle from "../hooks/useTitle";
import React, { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { Camera, ChevronDown, Check, X, Users, AlertCircle, Calendar, CheckCircle, Clock, BookOpen, Layers } from "lucide-react";
import { Link } from "react-router-dom";
import { FluidDropdown } from "../components/ui/FluidDropdown";
import { BackButton } from "../components/ui/back-button";

/* ── Dropdown Replaced globally by FluidDropdown ──────────────────────────────────────────────────── */

/* ── Live Session Dashboard (teacher monitors students scanning) ── */
function LiveSession({ session, onEnd }) {
  const [records, setRecords] = useState([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [ending, setEnding] = useState(false);

  // Live records listener
  useEffect(() => {
    const q = query(
      collection(db, "attendance"),
      where("sessionId", "==", session.sessionId)
    );
    return onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
      setRecords(list);
    });
  }, [session.sessionId]);

  // Total students in section
  useEffect(() => {
    const q = query(
      collection(db, "users"),
      where("role", "==", "student"),
      where("section", "==", session.section)
    );
    return onSnapshot(q, (snap) => setTotalStudents(snap.size));
  }, [session.section]);

  async function handleEnd() {
    setEnding(true);
    try {
      await updateDoc(doc(db, "faceAttendanceSessions", session.docId), {
        status: "ended",
        endedAt: serverTimestamp(),
      });
      onEnd();
    } catch (e) {
      console.error("Error ending session:", e);
      setEnding(false);
    }
  }

  const presentCount = records.length;
  const percent = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0;
  const barColor = percent < 50 ? "#ef4444" : percent < 75 ? "#eab308" : "#10b981";
  const wifiCount = records.filter((r) => r.method === "wifi" || r.wifiVerified).length;

  function formatTime(isoString) {
    if (!isoString) return "";
    const d = new Date(isoString);
    let h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, "0");
    const s = String(d.getSeconds()).padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${m}:${s} ${ampm}`;
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Status Banner */}
      <div className="glass-card p-5 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" style={{ animation: "pulse 1.5s infinite" }} />
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Session Live</span>
          </div>
          <p className="text-lg font-bold text-slate-100">
            {session.subject}&nbsp;·&nbsp;
            <span className="gradient-text">{session.section}</span>
          </p>
          <p className="text-xs text-slate-500 mt-0.5">{session.date}</p>
        </div>
        <button
          onClick={handleEnd}
          disabled={ending}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors"
        >
          <X size={15} /> {ending ? "Ending…" : "End Session"}
        </button>
      </div>

      {/* Info Card */}
      <div className="glass-card p-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)" }}>
          <Camera size={22} className="text-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-100">Students are scanning their faces</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Students with the app open will see a "Scan My Face" button and verify themselves using their own camera.
          </p>
        </div>
      </div>

      {/* Stats + Progress */}
      <div className="grid grid-cols-4 gap-4">
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-emerald-400">{presentCount}</p>
          <p className="text-xs text-slate-400 mt-1">Verified</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-cyan-400">{wifiCount}</p>
          <p className="text-xs text-slate-400 mt-1">📶 Wi-Fi</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-slate-300">{totalStudents}</p>
          <p className="text-xs text-slate-400 mt-1">Total Students</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold" style={{ color: barColor }}>{percent}%</p>
          <p className="text-xs text-slate-400 mt-1">Attendance</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-400">Progress</span>
          <span className="text-xs font-bold" style={{ color: barColor }}>{presentCount} / {totalStudents}</span>
        </div>
        <div className="h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${percent}%`, background: barColor }}
          />
        </div>
      </div>

      {/* Live Student List */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={15} className="text-slate-400" />
            <span className="text-sm font-bold text-slate-200">Verified Students</span>
          </div>
          <span className="text-xs text-emerald-400 font-semibold">{presentCount} present</span>
        </div>

        {records.length === 0 ? (
          <div className="py-10 text-center">
            <Clock size={28} className="mx-auto text-slate-600 mb-2" />
            <p className="text-sm text-slate-500">Waiting for students to scan their faces…</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {records.map((r, i) => (
              <div key={r.id} className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-colors animate-slide-up"
                style={{ animationDelay: `${i * 30}ms` }}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white"
                    style={{ background: "rgba(16,185,129,0.25)" }}>
                    {r.studentName?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">{r.studentName}</p>
                    <p className="text-xs text-slate-500">{r.rollNumber || r.studentId?.slice(0, 8)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {(r.method === "wifi" || r.wifiVerified) && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase"
                      style={{ background: "rgba(6,182,212,0.12)", color: "#22d3ee", border: "1px solid rgba(6,182,212,0.2)" }}>
                      📶 Auto
                    </span>
                  )}
                  {r.method === "face" && (
                    <span className="text-xs text-slate-500">{r.confidence ? `${r.confidence}%` : ""}</span>
                  )}
                  <span className="text-xs text-slate-500">{formatTime(r.timestamp)}</span>
                  <CheckCircle size={18} className="text-emerald-400" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main Export ──────────────────────────────────────────────── */
export default function FaceAttendance() {
  useTitle("Face Attendance");
  const { currentUser, userProfile } = useAuth();

  const [timetableEntries, setEntries] = useState([]);
  const [ttLoading, setTtLoading] = useState(true);
  const [subject, setSubject] = useState("");
  const [section, setSection] = useState("");
  const [session, setSession] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [startError, setStartError] = useState("");

  // ── Real-time listener: fetch ANY active session for this teacher ──
  // This is the DATABASE as source of truth — survives logout/login
  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, "faceAttendanceSessions"),
      where("teacherId", "==", currentUser.uid),
      where("status", "==", "active")
    );
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const d = snap.docs[0];
        setSession({ docId: d.id, ...d.data() });
      } else {
        setSession(null);
      }
      setSessionLoading(false);
    });
    return unsub;
  }, [currentUser]);

  // Fetch teacher timetable
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, "timetable"), where("teacherUid", "==", currentUser.uid));
    return onSnapshot(q, (snap) => {
      setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setTtLoading(false);
    });
  }, [currentUser]);

  const subjects = [...new Set(timetableEntries.map((e) => e.subject))].sort();
  const sections = subject
    ? [...new Set(timetableEntries.filter((e) => e.subject === subject).map((e) => e.section))].sort()
    : [];

  function handleSubjectChange(e) {
    setSubject(e.target.value);
    setSection("");
    setStartError("");
  }

  async function handleStartSession() {
    if (!subject || !section) return;
    setStartError("");

    // Prevent duplicate: check if teacher already has an active session
    const existingQ = query(
      collection(db, "faceAttendanceSessions"),
      where("teacherId", "==", currentUser.uid),
      where("status", "==", "active")
    );
    const existingSnap = await getDocs(existingQ);
    if (!existingSnap.empty) {
      setStartError("A session is already running. Please end it before starting a new one.");
      return;
    }

    const now = new Date();
    const sessionId = `face_${currentUser.uid}_${Date.now()}`;
    const sessionData = {
      sessionId,
      teacherId: currentUser.uid,
      teacherName: userProfile?.name || "Teacher",
      subject,
      section,
      type: "face",
      status: "active",
      date: now.toLocaleDateString("en-IN"),
      startTime: now.toISOString(),
      createdAt: serverTimestamp(),
    };

    await addDoc(collection(db, "faceAttendanceSessions"), sessionData);
    // No need to setSession — the onSnapshot listener will pick it up automatically
  }

  function handleEnd() {
    // Session is cleared automatically by the onSnapshot listener when status becomes "ended"
    setSubject("");
    setSection("");
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start gap-4 sm:items-center">
        <BackButton className="mt-1 sm:mt-0" />
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="badge bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Face AI</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Face Recognition Attendance</h1>
          <p className="text-slate-400 text-sm mt-1">
            Start a face attendance session — students will scan their own faces to verify
          </p>
        </div>
      </div>

      {sessionLoading ? (
        <div className="glass-card p-8 flex flex-col items-center gap-4 text-center max-w-lg mx-auto">
          <div className="model-loading-spinner" />
          <p className="text-slate-300 font-medium">Checking for active sessions…</p>
        </div>
      ) : session ? (
        <LiveSession session={session} onEnd={handleEnd} />
      ) : (
        /* ── Start Session Form ── */
        <div className="max-w-lg mx-auto">
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)" }}>
                <Camera size={20} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-100">Start Face Attendance Session</p>
                <p className="text-xs text-slate-400">Students will scan their own faces on their devices</p>
              </div>
            </div>

            {ttLoading ? (
              <p className="text-sm text-slate-500 py-2">Loading your timetable…</p>
            ) : timetableEntries.length === 0 ? (
              <div className="flex flex-col items-center text-center gap-3 py-6">
                <Calendar size={28} className="text-amber-400" />
                <p className="text-slate-200 font-medium">No timetable set up yet</p>
                <p className="text-xs text-slate-400">Add your class schedule first.</p>
                <Link to="/teacher/timetable" className="text-sm text-indigo-400 hover:text-indigo-300 underline transition-colors">
                  Go to Timetable →
                </Link>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="relative z-20">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Subject</label>
                  <FluidDropdown
                    options={[
                      { id: "", label: "— Select subject —", icon: BookOpen },
                      ...subjects.map(s => ({ id: s, label: s, icon: BookOpen, color: "#a78bfa" }))
                    ]}
                    value={subject}
                    onChange={(val) => handleSubjectChange({ target: { value: val } })}
                    placeholder="— Select subject —"
                  />
                </div>
                
                <div className={`transition-all duration-500 ease-out origin-top relative z-10 ${!subject ? 'opacity-40 scale-95 pointer-events-none' : 'opacity-100 scale-100'}`}>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Section</label>
                  <FluidDropdown
                    options={[
                      { id: "", label: subject ? "— Select section —" : "— Pick subject first —", icon: Layers },
                      ...sections.map(s => ({ id: s, label: s, icon: Layers, color: "#38bdf8" }))
                    ]}
                    value={section}
                    onChange={(val) => setSection(val)}
                    disabled={!subject}
                    placeholder={subject ? "— Select section —" : "— Pick subject first —"}
                  />
                </div>

                {/* Info box */}
                <div className="flex items-start gap-3 rounded-xl px-5 py-4 backdrop-blur-md shadow-inner transition-colors duration-300 hover:bg-indigo-500/10"
                  style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)" }}>
                  <Camera size={20} className="text-indigo-400 shrink-0" />
                  <p className="text-[13px] leading-relaxed text-slate-400">
                    <strong className="text-slate-200">How it works:</strong> Students see a "Scan My Face" button on their dashboard. 
                    They scan their face using their own phone/laptop camera. The system verifies them against their registered face data and auto-marks attendance.
                  </p>
                </div>

                {/* Duplicate session warning */}
                {startError && (
                  <div className="flex items-start gap-3 rounded-xl px-4 py-3"
                    style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                    <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
                    <p className="text-[13px] text-red-300 font-medium">{startError}</p>
                  </div>
                )}

                <button
                  onClick={handleStartSession}
                  disabled={!subject || !section}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold py-4 rounded-xl shadow-[0_8px_20px_rgba(16,185,129,0.25)] transition-all duration-300 transform hover:-translate-y-0.5 mt-2 flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:translate-y-0 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  <Camera size={20} />
                  Start Face Attendance Session
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
