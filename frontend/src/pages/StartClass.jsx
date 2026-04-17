import useTitle from "../hooks/useTitle";
import React, { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { isIndexError } from "../lib/firestoreUtils";
import { useAuth } from "../contexts/AuthContext";
import { Link } from "react-router-dom";
import { QrCode, Clock, Users, X, CheckCircle, ChevronDown, Calendar, BookOpen, Layers } from "lucide-react";
import { FluidDropdown } from "../components/ui/FluidDropdown";
import { BackButton } from "../components/ui/back-button";
import { formatSafeTime, formatSafeDate } from "../lib/dateUtils";

// ── helpers ──────────────────────────────────────────────────────────────────
function pad(n) { return String(n).padStart(2, "0"); }

function formatCountdown(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${pad(m)}:${pad(s)}`;
}

/* ── Select Replaced globally by FluidDropdown ─────────────────────────────────────────────────────────── */
// ── Start-Class Form ─────────────────────────────────────────────────────────
function ClassForm({ onStart, timetableEntries, loading }) {
  const [subject, setSubject] = useState("");
  const [section, setSection] = useState("");
  const [err, setErr]         = useState("");

  // Unique subjects from teacher's timetable
  const subjects = [...new Set(timetableEntries.map((e) => e.subject))].sort();

  // Sections available for the selected subject
  const sections = subject
    ? [...new Set(
        timetableEntries
          .filter((e) => e.subject === subject)
          .map((e) => e.section)
      )].sort()
    : [];

  // Reset section when subject changes
  function handleSubjectChange(e) {
    setSubject(e.target.value);
    setSection("");
    setErr("");
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!subject) return setErr("Please select a subject.");
    if (!section) return setErr("Please select a section.");
    setErr("");
    onStart(subject, section);
  }

  // ── No timetable yet ──────────────────────────────────────────────────────
  if (!loading && timetableEntries.length === 0) {
    return (
      <div className="glass-card p-8 max-w-md mx-auto flex flex-col items-center text-center gap-4">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)" }}
        >
          <Calendar size={28} className="text-amber-400" />
        </div>
        <div>
          <p className="text-slate-100 font-semibold mb-1">No timetable set up yet</p>
          <p className="text-sm text-slate-400">
            You need to add your class schedule before starting a session.
          </p>
        </div>
        <Link
          to="/teacher/timetable"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105"
          style={{
            background: "linear-gradient(135deg,rgba(99,102,241,0.2),rgba(139,92,246,0.2))",
            border: "1px solid rgba(99,102,241,0.3)",
            color: "#a78bfa",
          }}
        >
          <Calendar size={16} />
          Go to Timetable Page
        </Link>
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <div className="relative glass-card p-6 max-w-md mx-auto overflow-visible z-20">
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)" }}
        >
          <QrCode size={20} className="text-indigo-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-100">Start a Class Session</p>
          <p className="text-xs text-slate-400">A QR code will be generated for students to scan</p>
        </div>
      </div>

      {err && (
        <div className="mb-4 px-4 py-2.5 rounded-xl text-sm text-red-300 bg-red-500/10 border border-red-500/20">
          {err}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500 py-4 text-center">Loading your timetable…</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative z-20">
            <label className="block text-xs text-slate-400 mb-1.5">Subject *</label>
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
          <div className={`relative z-10 transition-all duration-300 ${!subject ? 'opacity-50' : 'opacity-100'}`}>
            <label className="block text-xs text-slate-400 mb-1.5">Class / Section *</label>
            <FluidDropdown
              options={[
                { id: "", label: subject ? "— Select section —" : "— Pick a subject first —", icon: Layers },
                ...sections.map(s => ({ id: s, label: s, icon: Layers, color: "#38bdf8" }))
              ]}
              value={section}
              onChange={(val) => { setSection(val); setErr(""); }}
              disabled={!subject}
              placeholder={subject ? "— Select section —" : "— Pick a subject first —"}
            />
          </div>
          <button
            id="sc-start"
            type="submit"
            className="btn-primary"
            style={{ padding: "0.7rem 1.5rem", width: "auto" }}
          >
            Generate QR Code →
          </button>
        </form>
      )}
    </div>
  );
}

// ── Active-Session View ───────────────────────────────────────────────────────
function ActiveSession({ session, onEnd }) {
  const SESSION_DURATION = 180; // 3 minutes
  const [timeLeft, setTimeLeft] = useState(SESSION_DURATION);
  const [attendees, setAttendees] = useState([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [indexBuilding, setIndexBuilding] = useState(false);
  const [ended, setEnded] = useState(false);

  // Build QR payload
  const qrPayload = JSON.stringify({
    sessionId: session.sessionId,
    subject:   session.subject,
    section:   session.section,
    teacherId: session.teacherId,
    date:      session.date,
    expiryTime: session.expiryTime,
  });

  // Countdown
  useEffect(() => {
    if (ended) return;
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(interval);
          handleExpired();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [ended]);

  // Fetch total students in this section
  useEffect(() => {
    const q = query(
      collection(db, "users"),
      where("role", "==", "student"),
      where("section", "==", session.section)
    );
    const unsub = onSnapshot(q, (snap) => {
      setTotalStudents(snap.size);
      setIndexBuilding(false);
    }, (err) => {
      console.error("Students Snapshot Error:", err);
      if (isIndexError(err)) setIndexBuilding(true);
    });
    return unsub;
  }, [session.section]);

  // Live attendance count
  useEffect(() => {
    const q = query(
      collection(db, "attendance"),
      where("sessionId", "==", session.sessionId)
    );
    return onSnapshot(q, (snap) => {
      setAttendees(snap.docs.map((d) => d.data()));
      setIndexBuilding(false);
    }, (err) => {
      console.error("Active Attendance Error:", err);
      if (isIndexError(err)) setIndexBuilding(true);
    });
  }, [session.sessionId]);

  async function handleExpired() {
    if (!session.docId) return;
    await updateDoc(doc(db, "sessions", session.docId), { isActive: false });
  }

  async function handleEndClass() {
    if (session.docId) {
      await updateDoc(doc(db, "sessions", session.docId), { isActive: false });
    }
    setEnded(true);
    onEnd();
  }

  const isExpired = timeLeft === 0;
  const percent   = Math.max(0, timeLeft / SESSION_DURATION);
  const urgent    = timeLeft < 120;
  
  const totalAbsent = totalStudents ? totalStudents - attendees.length : 0;
  const attendancePercent = totalStudents > 0 ? (attendees.length / totalStudents) * 100 : 0;
  const attBadgeColor = attendancePercent >= 80 
    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" 
    : "bg-red-500/15 text-red-400 border-red-500/20";
    
  if (indexBuilding) {
    return (
      <div className="glass-card p-12 flex flex-col items-center justify-center text-center gap-4 animate-fade-in shadow-xl bg-slate-800/20">
        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
        <div>
          <h2 className="text-lg font-bold text-slate-100">Preparing session...</h2>
          <p className="text-slate-400 text-xs mt-1 max-w-sm">
            We're setting up the necessary connections for live attendance. Please wait a moment.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Status Banner */}
      <div className="glass-card p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-400 mb-0.5">Active Session</p>
          <p className="text-lg font-bold text-slate-100">
            {session.subject} &nbsp;·&nbsp;
            <span className="gradient-text">{session.section}</span>
          </p>
          <p className="text-xs text-slate-500 mt-0.5">{session.date}</p>
        </div>
        {!isExpired && (
          <button
            id="sc-end"
            onClick={handleEndClass}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors"
          >
            <X size={15} /> End Class
          </button>
        )}
      </div>

      {/* QR + Countdown */}
      <div className="glass-card p-6 flex flex-col items-center gap-6">
        {isExpired ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)" }}>
              <Clock size={28} className="text-red-400" />
            </div>
            <p className="text-lg font-bold text-red-400">Session Expired</p>
            <p className="text-sm text-slate-400 mt-1">The QR code is no longer valid.</p>
            <button onClick={handleEndClass} className="btn-primary mt-4" style={{ width: "auto", padding: "0.6rem 1.5rem" }}>
              Close
            </button>
          </div>
        ) : (
          <>
            {/* QR Code */}
            <div
              className="p-4 rounded-2xl"
              style={{ background: "#fff" }}
            >
              <QRCodeSVG
                value={qrPayload}
                size={220}
                level="H"
                includeMargin={false}
              />
            </div>

            {/* Timer bar */}
            <div className="w-full">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Clock size={14} className={urgent ? "text-red-400" : "text-indigo-400"} />
                  <span className="text-xs text-slate-400">Expires in</span>
                </div>
                <span
                  className={`text-xl font-bold font-mono ${urgent ? "text-red-400" : "text-indigo-400"}`}
                >
                  {formatCountdown(timeLeft)}
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width: `${percent * 100}%`,
                    background: urgent
                      ? "linear-gradient(90deg,#ef4444,#f97316)"
                      : "linear-gradient(90deg,#6366f1,#8b5cf6)",
                  }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Live Attendance Counter */}
      {!isExpired && (
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-emerald-400" />
              <p className="text-sm font-semibold text-slate-200">Live Attendance</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-1 rounded-lg">
                {totalStudents ? totalAbsent : "?"} Absent
              </span>
              <span className={`badge border text-xs ${attBadgeColor}`}>
                {attendees.length} / {totalStudents || "?"} present ({totalStudents > 0 ? attendancePercent.toFixed(0) : 0}%)
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-2.5 rounded-full overflow-hidden mb-4" style={{ background: "rgba(255,255,255,0.07)" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: totalStudents > 0 ? `${(attendees.length / totalStudents) * 100}%` : "0%",
                background: "linear-gradient(90deg,#10b981,#34d399)",
              }}
            />
          </div>

          {/* Student list */}
          {attendees.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-2">
              Waiting for students to scan…
            </p>
          ) : (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {attendees.map((a, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: "rgba(16,185,129,0.06)" }}>
                  <CheckCircle size={14} className="text-emerald-400 shrink-0" />
                  <span className="text-sm text-slate-200">{a.studentName}</span>
                  <span className="text-xs text-slate-500 ml-auto">{a.rollNumber || ""}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────
export default function StartClass() {
  useTitle("Start Class");
  const { currentUser, userProfile } = useAuth();
  const [session, setSession]           = useState(null);
  const [timetableEntries, setEntries]  = useState([]);
  const [ttLoading, setTtLoading]       = useState(true);
  const [indexBuilding, setIndexBuilding] = useState(false);

  // Fetch only this teacher's timetable entries (live)
  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, "timetable"),
      where("teacherUid", "==", currentUser.uid)
    );
    return onSnapshot(q, (snap) => {
      setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setTtLoading(false);
      setIndexBuilding(false);
    }, (err) => {
      console.error("Main Timetable Error:", err);
      if (isIndexError(err)) setIndexBuilding(true);
      setTtLoading(false);
    });
  }, [currentUser]);

  async function handleStart(subject, section) {
    const now         = new Date();
    const expiryTime  = new Date(now.getTime() + 3 * 60 * 1000);
    const sessionId   = `${currentUser.uid}_${Date.now()}`;
    const date        = now.toLocaleDateString("en-IN");

    const sessionData = {
      sessionId,
      teacherId:   currentUser.uid,
      teacherName: userProfile?.name || "Teacher",
      subject,
      section,
      startTime:   now.toISOString(),
      expiryTime:  expiryTime.toISOString(),
      isActive:    true,
      date:        now.toLocaleDateString("en-IN"),
      createdAt:   serverTimestamp(),
    };

    const ref = await addDoc(collection(db, "sessions"), sessionData);
    setSession({ ...sessionData, docId: ref.id });
  }

  function handleEnd() {
    setSession(null);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <BackButton />
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Start a Class</h1>
          <p className="text-slate-400 text-sm mt-1">
            Generate a QR code for attendance — valid for 3 minutes
          </p>
        </div>
      </div>

      {indexBuilding ? (
        <div className="glass-card p-12 flex flex-col items-center justify-center text-center gap-4 animate-fade-in shadow-xl bg-slate-800/20">
          <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
          <div>
            <h2 className="text-lg font-bold text-slate-100">Preparing class...</h2>
            <p className="text-slate-400 text-xs mt-1 max-w-sm">
              We're setting up the necessary connections to start your class. Please wait a moment.
            </p>
          </div>
        </div>
      ) : session ? (
        <ActiveSession session={session} onEnd={handleEnd} />
      ) : (
        <ClassForm
          onStart={handleStart}
          timetableEntries={timetableEntries}
          loading={ttLoading}
        />
      )}
    </div>
  );
}
