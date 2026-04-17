import useTitle from "../hooks/useTitle";
import React, { useState, useEffect } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { collection, query, where, orderBy, onSnapshot, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import Sidebar from "../components/Sidebar";
import StudentTimetable from "./StudentTimetable";
import ScanQR from "./ScanQR";
import ScanFace from "./ScanFace";
import StudentAttendance from "./StudentAttendance";

import CareerGoals from "./CareerGoals";
import FreePeriodTasks from "./FreePeriodTasks";
import DailyRoutine from "./DailyRoutine";
import useWifiAttendance from "../hooks/useWifiAttendance";
import { Calendar, ClipboardCheck, BookOpen, Star, TrendingUp, QrCode, Camera, X, Menu } from "lucide-react";

// ── Circular Attendance Ring ────────────────────────────────────
function AttendanceRing({ percent = 85 }) {
  const r = 44;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (percent / 100) * circumference;

  const color =
    percent >= 75 ? "#10b981" : percent >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <div className="flex flex-col items-center">
      <svg width="110" height="110" className="circular-progress">
        <circle cx="55" cy="55" r={r} className="circular-progress-track" />
        <circle
          cx="55"
          cy="55"
          r={r}
          className="circular-progress-fill"
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="mt-[-72px] flex flex-col items-center">
        <span className="text-2xl font-bold text-slate-100">{percent}%</span>
        <span className="text-[11px] text-slate-400">Attendance</span>
      </div>
    </div>
  );
}

// ── Stat Card ──────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = "#6366f1" }) {
  return (
    <div className="stat-card flex items-start gap-4">
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${color}20`, border: `1px solid ${color}30` }}
      >
        <Icon size={20} style={{ color }} />
      </div>
      <div>
        <p className="text-xs text-slate-400 mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-slate-100">{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Student Overview Page ──────────────────────────────────────
function StudentHome() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const { wifiStatus, wifiMessage } = useWifiAttendance();
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const todayName = new Date().toLocaleDateString("en-US", { weekday: "long" });

  // Live today's schedule from Firestore
  const [todayClasses, setTodayClasses] = useState([]);
  const [scheduleLoading, setScheduleLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "timetable"), orderBy("createdAt", "asc"));
    return onSnapshot(q, (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const section = userProfile?.assignedSection?.toUpperCase();
      const filtered = all
        .filter(
          (e) =>
            e.day === todayName &&
            (!section || e.section?.toUpperCase() === section)
        )
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
      setTodayClasses(filtered);
      setScheduleLoading(false);
    });
  }, [userProfile, todayName]);

  // ── Detect active face attendance session ──
  const [activeFaceSession, setActiveFaceSession] = useState(null);
  useEffect(() => {
    if (userProfile?.assignedSection == null) return;
    const q = query(
      collection(db, "faceAttendanceSessions"),
      where("section", "==", userProfile.assignedSection),
      where("status", "==", "active")
    );
    return onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const sessionDoc = snap.docs[0];
        setActiveFaceSession({ id: sessionDoc.id, ...sessionDoc.data() });
      } else {
        setActiveFaceSession(null);
      }
    });
  }, [userProfile]);

  function formatTime(t) {
    if (!t) return "";
    const [h, m] = t.split(":");
    const hour = parseInt(h, 10);
    return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
  }

  const now = new Date();
  function isPast(endTime) {
    if (!endTime) return false;
    const [h, m] = endTime.split(":");
    const end = new Date(); end.setHours(+h, +m, 0);
    return now > end;
  }

  const attendance = userProfile?.attendance ?? 85;
  const statusColor =
    attendance >= 75 ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
    : attendance >= 60 ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
    : "text-red-400 bg-red-500/10 border-red-500/20";
  const statusLabel = attendance >= 75 ? "Good Standing" : attendance >= 60 ? "At Risk" : "Critical";

  const [showAttendanceModal, setShowAttendanceModal] = useState(false);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {userProfile?.assignedSection == null && (
        <div className="mb-6 p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-medium flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
          You are not assigned to any section yet.
        </div>
      )}
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="badge bg-violet-500/20 text-violet-400 border border-violet-500/30">Student</span>
              {userProfile?.assignedSection != null && (
                <span className="badge bg-slate-500/20 text-slate-400 border border-slate-500/30">{userProfile.assignedSection}</span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-slate-100">
              Hello, <span className="gradient-text">{userProfile?.name?.split(" ")[0] || "Student"}</span> 👋
            </h1>
            <p className="text-slate-400 text-sm mt-1">{today}</p>
          </div>
          {/* Mark Attendance button */}
          {userProfile?.assignedSection != null ? (
            <button
              id="sq-attend-btn"
              onClick={() => setShowAttendanceModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105"
              style={{
                background: "linear-gradient(135deg,rgba(99,102,241,0.2),rgba(139,92,246,0.2))",
                border: "1px solid rgba(99,102,241,0.3)",
                color: "#a78bfa",
              }}
            >
              <ClipboardCheck size={18} />
              Mark Attendance
            </button>
          ) : (
             <button
              id="sq-attend-btn"
              disabled
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold opacity-50 cursor-not-allowed border border-indigo-500/20 bg-indigo-500/10 text-indigo-300"
            >
              <ClipboardCheck size={18} />
              Mark Attendance
            </button>
          )}
        </div>
      </div>

      {/* Active Face Session Banner */}
      {activeFaceSession && (
        <div
          className="mb-6 p-4 rounded-2xl flex items-center justify-between gap-4 animate-slide-up"
          style={{
            background: "linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.05))",
            border: "1px solid rgba(16,185,129,0.25)",
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(16,185,129,0.2)" }}>
              <Camera size={20} className="text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-emerald-300">
                Face Attendance Live — {activeFaceSession.subject}
              </p>
              <p className="text-xs text-slate-400 truncate">by {activeFaceSession.teacherName}</p>
            </div>
          </div>
          <button
            onClick={() => navigate("/student/scan-face")}
            className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-105"
            style={{
              background: "linear-gradient(135deg, #10b981, #059669)",
              color: "white",
              boxShadow: "0 4px 15px rgba(16,185,129,0.3)",
            }}
          >
            <Camera size={16} />
            Scan My Face
          </button>
        </div>
      )}

      {/* Attendance Method Selection Modal */}
      {showAttendanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.8)", backdropFilter: "blur(6px)" }}>
          <div className="glass-card w-[90%] max-w-md mx-auto shadow-2xl animate-scale-in p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-lg font-bold text-slate-100">Mark Attendance</p>
                <p className="text-xs text-slate-400 mt-0.5">Choose your verification method</p>
              </div>
              <button onClick={() => setShowAttendanceModal(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* QR Option */}
              <button
                onClick={() => { setShowAttendanceModal(false); navigate("/student/scan"); }}
                className="group text-left p-5 rounded-2xl transition-all duration-200 hover:scale-[1.03]"
                style={{
                  background: "rgba(99,102,241,0.06)",
                  border: "1px solid rgba(99,102,241,0.15)",
                }}
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)" }}>
                  <QrCode size={24} className="text-indigo-400" />
                </div>
                <p className="text-sm font-bold text-slate-100 mb-1">Scan QR Code</p>
                <p className="text-xs text-slate-400 mb-3">Point your camera at the QR code shown by your teacher</p>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest"
                  style={{ background: "rgba(99,102,241,0.12)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.2)" }}>
                  ⚡ Fast
                </span>
              </button>

              {/* Face Option */}
              <button
                onClick={() => { setShowAttendanceModal(false); navigate("/student/scan-face"); }}
                className="group text-left p-5 rounded-2xl transition-all duration-200 hover:scale-[1.03]"
                style={{
                  background: "rgba(16,185,129,0.06)",
                  border: "1px solid rgba(16,185,129,0.15)",
                }}
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)" }}>
                  <Camera size={24} className="text-emerald-400" />
                </div>
                <p className="text-sm font-bold text-slate-100 mb-1">Face Recognition</p>
                <p className="text-xs text-slate-400 mb-3">Verify your identity by scanning your face with the camera</p>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest"
                  style={{ background: "rgba(16,185,129,0.12)", color: "#34d399", border: "1px solid rgba(16,185,129,0.2)" }}>
                  🔒 Secure
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Wi-Fi Proximity Status Badge */}
      {wifiStatus !== "idle" && (
        <div
          className="mb-4 px-4 py-2.5 rounded-xl flex items-center gap-2 text-xs"
          style={{
            background: wifiStatus === "verified"
              ? "rgba(16,185,129,0.06)"
              : "rgba(255,255,255,0.02)",
            border: `1px solid ${wifiStatus === "verified" ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.06)"}`,
          }}
        >
          <span style={{ fontSize: "14px" }}>📶</span>
          <span className={wifiStatus === "verified" ? "text-emerald-400 font-semibold" : "text-slate-500"}>
            {wifiStatus === "verified"
              ? "Location verified automatically"
              : wifiStatus === "checking"
              ? "Checking network…"
              : wifiStatus === "not-on-network"
              ? "Not detected on campus network — try QR or Face"
              : "Network check unavailable"}
          </span>
        </div>
      )}

      {/* TOP SECTION: Urgent Assignments Alert */}
      <div 
        className="mb-8 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:scale-[1.01] transition-transform shadow-lg shadow-red-500/5"
        style={{ background: "linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(249, 115, 22, 0.05))", border: "1px solid rgba(239, 68, 68, 0.25)" }}
        onClick={() => navigate("/student/tasks")}    
      >
         <div className="flex items-start gap-4">
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center shrink-0 shadow-inner" style={{ background: "linear-gradient(135deg, #ef4444, #dc2626)" }}>
              <BookOpen size={28} className="text-white" />
            </div>
            <div>
               <p className="text-[10px] md:text-xs font-bold text-red-300 uppercase tracking-widest mb-1 flex items-center gap-2">
                 <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse"></span>
                 Action Required
               </p>
               <p className="text-lg md:text-xl font-bold text-slate-100">Assignments Due: 2 <span className="text-red-300 font-medium text-sm ml-1">— Submit by Friday</span></p>
               <p className="text-xs font-bold text-red-400 mt-0.5">2 assignments due in 4 days</p>
            </div>
         </div>
         <button className="shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-colors">
            View →
         </button>
      </div>

      {/* MIDDLE SECTION: Status & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        
        {/* Attendance Ring */}
        <div className="stat-card flex flex-col items-center justify-center gap-3 p-6 py-8">
          {userProfile?.assignedSection == null && (
            <div className="text-center py-6">
               <div className="text-slate-500 mb-2 opacity-50 flex justify-center"><ClipboardCheck size={32} /></div>
               <p className="text-sm font-bold text-slate-400">Section not assigned</p>
            </div>
          )}
          
          {userProfile?.assignedSection != null && (
            <>
              <AttendanceRing percent={attendance} />
              <div className="flex items-center gap-2 mt-2">
                 <div className={"badge " + statusColor + " text-[10px] uppercase font-bold tracking-wider border"}>{statusLabel}</div>
                 {attendance < 85 && (
                    <span className="text-[16px] animate-bounce" title="Low Attendance Warning">??</span>
                 )}
              </div>
              {attendance < 75 && (
                <p className="text-[10px] text-slate-500 text-center uppercase font-bold max-w-xs mt-1">
                  Need {Math.ceil((0.75 * (100 / (attendance / 100))) - 100)} more sessions to reach 75%
                </p>
              )}
            </>
          )}
        </div>

        {/* Other Status Stats */}
        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
           <div className="stat-card p-6 flex flex-col justify-center gap-2 hover:bg-white/[0.04] transition-colors">
              <div className="flex items-center gap-3 mb-2">
                 <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "rgba(99,102,241,0.15)" }}>
                    <Calendar size={24} className="text-indigo-400" />
                 </div>
                 <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Classes Attended</p>
              </div>
              <p className="text-4xl font-black text-slate-100 mt-2">62 <span className="text-lg text-slate-500 font-semibold">/ 72</span></p>
           </div>
           
           <div className="stat-card p-6 flex flex-col justify-center gap-2 hover:bg-white/[0.04] transition-colors">
              <div className="flex items-center gap-3 mb-2">
                 <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "rgba(16,185,129,0.15)" }}>
                    <TrendingUp size={24} className="text-emerald-400" />
                 </div>
                 <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Current CGPA</p>
              </div>
              <p className="text-4xl font-black text-slate-100 mt-2">8.4 <span className="text-lg text-slate-500 font-semibold">Sem 4</span></p>
           </div>
        </div>

      </div>

      {/* BOTTOM SECTION: Goals & Schedule */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
         <div className="md:col-span-1 space-y-6">
            <div>
               <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Secondary Info</h2>
               <div className="stat-card p-5 flex items-center gap-5 hover:-translate-y-1 transition-transform cursor-pointer" onClick={() => navigate("/student/goals")}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(139,92,246,0.15)" }}>
                     <Star size={24} className="text-violet-400" />
                  </div>
                  <div>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Goals Set</p>
                     <p className="text-2xl font-black text-slate-100 mb-0.5">3</p>
                     <p className="text-xs text-slate-500">Active career targets</p>
                  </div>
               </div>
            </div>
            
            {/* Student ID Info */}
            {(userProfile?.rollNumber || userProfile?.assignedSection) && (
              <div className="stat-card p-5 flex flex-col gap-4">
                {userProfile.rollNumber && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Roll Number</span>
                    <span className="text-sm font-bold text-slate-200 px-3 py-1 bg-slate-800 rounded-lg">{userProfile.rollNumber}</span>
                  </div>
                )}
                {userProfile.assignedSection && (
                  <div className="flex justify-between items-center pt-3 border-t border-white/[0.05]">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Section</span>
                    <span className="text-sm font-bold text-indigo-300 px-3 py-1 bg-indigo-500/10 rounded-lg">{userProfile.assignedSection}</span>
                  </div>
                )}
              </div>
            )}
         </div>

         <div className="md:col-span-2">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Today's Schedule</h2>
            <div className="glass-card divide-y divide-white/[0.05] overflow-hidden">
               {scheduleLoading ? (
                 <div className="py-8 text-center text-xs text-slate-500">Loading schedule…</div>
               ) : todayClasses.length === 0 ? (
                 <div className="py-12 text-center flex flex-col items-center">
                   <div className="w-16 h-16 rounded-3xl bg-slate-800/50 flex items-center justify-center mb-4">
                     <Calendar size={32} className="text-slate-600" />
                   </div>
                   <p className="text-sm font-semibold text-slate-400">No classes scheduled for {todayName}.</p>
                 </div>
               ) : (
                 todayClasses.map((item) => {
                   const done = isPast(item.endTime);
                   return (
                     <div key={item.id} className="flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors">
                       <div className="flex items-center gap-4">
                         <span className="text-xs font-medium text-slate-500 w-24 shrink-0">
                           {formatTime(item.startTime)}
                         </span>
                         <div>
                           <p className="text-sm font-bold text-slate-200">{item.subject}</p>
                           <p className="text-[11px] font-semibold text-slate-500 mt-0.5">{item.room || "—"}</p>
                         </div>
                       </div>
                       <span
                         className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-lg ${
                           done
                             ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                             : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                         }`}
                       >
                         {done ? "Done" : "Upcoming"}
                       </span>
                     </div>
                   );
                 })
               )}
            </div>
         </div>
      </div>
    </div>
  );
}

// Placeholder sub-pages
function PlaceholderPage({ title, icon: Icon }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)" }}>
        <Icon size={28} className="text-violet-400" />
      </div>
      <h2 className="text-xl font-bold text-slate-200 mb-2">{title}</h2>
      <p className="text-slate-400 text-sm max-w-xs">This feature is coming in Phase 2 — QR check-in, goal tracking, and more!</p>
      <span className="mt-4 badge bg-amber-500/15 text-amber-400 border border-amber-500/25 text-xs">Coming Soon</span>
    </div>
  );
}

// ── Main Export ────────────────────────────────────────────────
export default function StudentDashboard() {
  useTitle("Dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="dashboard-layout">
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <main className="dashboard-main flex flex-col relative w-full">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-white/[0.06] bg-[#0f0f1a] sticky top-0 z-30">
          <span className="text-sm font-bold gradient-text tracking-wide truncate">SmartCurriculum</span>
          <button onClick={() => setMobileOpen(true)} className="text-slate-400 hover:text-white transition-colors">
            <Menu size={24} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          <Routes>
            <Route index element={<StudentHome />} />
            <Route path="scan" element={<ScanQR />} />
            <Route path="scan-face" element={<ScanFace />} />
            <Route path="attendance" element={<StudentAttendance />} />
            <Route path="routine" element={<DailyRoutine />} />
            <Route path="tasks" element={<FreePeriodTasks />} />
            <Route path="goals" element={<CareerGoals />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
