import useTitle from "../hooks/useTitle";
import React, { useState } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Sidebar from "../components/Sidebar";
import TimetablePage from "./TimetablePage";
import StartClass from "./StartClass";
import AttendancePage from "./AttendancePage";
import FaceRegister from "./FaceRegister";
import FaceAttendance from "./FaceAttendance";
import NetworkSettings from "./NetworkSettings";
import TeacherReports from "./TeacherReports";
import { Calendar, ClipboardCheck, BarChart, Users, Bell, QrCode, Menu } from "lucide-react";

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

// ── Quick Action Card (Compact) ──────────────────────────────────
function QuickAction({ icon: Icon, label, description, color = "#6366f1", onClick }) {
  return (
    <button onClick={onClick} className="glass-card p-4 text-left hover:-translate-y-1 w-full transition-transform duration-200 cursor-pointer flex items-center gap-3">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${color}20`, border: `1px solid ${color}30` }}
      >
        <Icon size={20} style={{ color }} />
      </div>
      <div>
        <p className="text-sm font-bold text-slate-200">{label}</p>
        <p className="text-[11px] text-slate-400 mt-0.5">{description}</p>
      </div>
    </button>
  );
}

// ── Overview Page ──────────────────────────────────────────────
function TeacherHome() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="badge bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">Teacher</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-100">
          Welcome back, <span className="gradient-text">{userProfile?.name?.split(" ")[0] || "Teacher"}</span> 👋
        </h1>
        <p className="text-slate-400 text-sm mt-1">{today}</p>
      </div>
      
      {/* 1. Main Hero: Pending Tasks */}
      <div 
        className="mb-8 p-6 rounded-2xl flex items-center gap-6 cursor-pointer hover:scale-[1.01] transition-transform shadow-lg shadow-red-500/5 relative overflow-hidden" 
        style={{ background: "linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.05))", border: "1px solid rgba(239, 68, 68, 0.3)" }}
      >
        <div className="absolute -right-10 -top-10 w-32 h-32 bg-red-500/10 blur-3xl rounded-full pointer-events-none"></div>
        <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-inner" style={{ background: "linear-gradient(135deg, #ef4444, #dc2626)" }}>
          <Bell size={32} />
        </div>
        <div>
          <p className="text-4xl md:text-5xl font-black text-red-400 leading-none mb-1">3</p>
          <p className="text-xs md:text-sm font-bold text-red-300 uppercase tracking-widest">Pending Tasks to Grade</p>
        </div>
      </div>

      {/* 2. Compact Single-row Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <div className="glass-card px-4 py-3 flex items-center justify-between">
           <div>
             <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Total Students</p>
             <p className="text-lg font-bold text-slate-200">124</p>
           </div>
           <Users size={20} className="text-indigo-400 opacity-50" />
        </div>
        <div className="glass-card px-4 py-3 flex items-center justify-between">
           <div>
             <p className="text-[10px] font-bold text-emerald-500/70 uppercase tracking-widest mb-0.5">Classes Today</p>
             <p className="text-lg font-bold text-emerald-400">5</p>
           </div>
           <ClipboardCheck size={20} className="text-emerald-400 opacity-50" />
        </div>
        <div className="glass-card px-4 py-3 flex items-center justify-between">
           <div>
             <p className="text-[10px] font-bold text-emerald-500/70 uppercase tracking-widest mb-0.5">Avg Attendance</p>
             <p className="text-lg font-bold text-emerald-400">87%</p>
           </div>
           <BarChart size={20} className="text-emerald-400 opacity-50" />
        </div>
      </div>

      {/* 3. Prominent Low Attendance Alert */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
            Low Attendance Alert (Top 3)
          </h2>
          <button onClick={() => navigate("/teacher/reports")} className="text-[10px] uppercase font-bold text-slate-400 hover:text-white transition-colors">
            View All →
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
           {[
             { name: "Arjun Mehta", section: "CS-A", roll: "22BCS012", att: "54%", color: "red" },
             { name: "Priya Sharma", section: "CS-B", roll: "22BCS089", att: "61%", color: "red" },
             { name: "Rahul Verma", section: "CS-A", roll: "22BCS045", att: "72%", color: "orange" },
           ].map((s, idx) => (
             <div key={idx} className="glass-card p-4 hover:-translate-y-1 transition-transform cursor-pointer" 
                  style={{ 
                    border: `1px solid ${s.color === "red" ? "rgba(239, 68, 68, 0.25)" : "rgba(249, 115, 22, 0.25)"}`, 
                    background: `linear-gradient(135deg, ${s.color === "red" ? "rgba(239, 68, 68, 0.08)" : "rgba(249, 115, 22, 0.08)"}, transparent)` 
                  }}>
                <div className="flex justify-between items-start mb-2">
                   <p className="text-sm font-bold text-slate-200 truncate pr-2">{s.name}</p>
                   <span className={`text-sm font-black ${s.color === "red" ? "text-red-400" : "text-orange-400"}`}>{s.att}</span>
                </div>
                <p className="text-xs font-medium text-slate-400">{s.section} &nbsp;·&nbsp; {s.roll}</p>
             </div>
           ))}
        </div>
      </div>

      {/* 4. Compact Quick Actions */}
      <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Quick Actions</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <QuickAction icon={ClipboardCheck} label="Attendance" description="Mark attendance via QR or Manual" color="#10b981" onClick={() => navigate("/teacher/attendance")} />
        <QuickAction icon={Calendar} label="Manage Timetable" description="Add or remove class entries" color="#8b5cf6" onClick={() => navigate("/teacher/timetable")} />
        <QuickAction icon={BarChart} label="View Reports" description="Student performance analytics" color="#6366f1" onClick={() => navigate("/teacher/reports")} />
      </div>
    </div>
  );
}

// Placeholder sub-pages
function PlaceholderPage({ title, icon: Icon }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)" }}>
        <Icon size={28} className="text-indigo-400" />
      </div>
      <h2 className="text-xl font-bold text-slate-200 mb-2">{title}</h2>
      <p className="text-slate-400 text-sm max-w-xs">This feature is coming in Phase 2 — QR attendance, real analytics, and more!</p>
      <span className="mt-4 badge bg-amber-500/15 text-amber-400 border border-amber-500/25 text-xs">Coming Soon</span>
    </div>
  );
}

// ── Main Export ────────────────────────────────────────────────
export default function TeacherDashboard() {
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
            <Route index element={<TeacherHome />} />
            <Route path="timetable" element={<TimetablePage />} />
            <Route path="class" element={<StartClass />} />
            <Route path="attendance" element={<AttendancePage />} />
            <Route path="face-register" element={<FaceRegister />} />
            <Route path="face-attendance" element={<FaceAttendance />} />
            <Route path="network-settings" element={<NetworkSettings />} />
            <Route path="reports" element={<TeacherReports />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
