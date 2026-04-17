import useTitle from "../hooks/useTitle";
import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { QrCode, ClipboardCheck, ChevronDown, Calendar, Check, X, Save, Users, ChevronLeft, Download, Search, Camera, Wifi, BookOpen, Layers, SlidersHorizontal, Pencil } from "lucide-react";
import { FluidDropdown } from "../components/ui/FluidDropdown";
import { formatSafeTime, formatSafeDate, formatHM } from "../lib/dateUtils";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from "recharts";

// ── Helpers ───────────────────────────────────────────────────────────────────
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── Global formatters used instead of local formatTime and isoToDisplay ─────────────────────

// ── FluidDropdown replaced native Select ─────────────────────────────────────────

// ── Manual Attendance Form ─────────────────────────────────────────────────────
function ManualAttendance({ onBack }) {
  const { currentUser, userProfile } = useAuth();

  const [timetableEntries, setEntries] = useState([]);
  const [ttLoading, setTtLoading]      = useState(true);

  const [subject, setSubject]   = useState("");
  const [section, setSection]   = useState("");
  const [date, setDate]         = useState(todayISO());

  const [students, setStudents]     = useState([]); 
  const [studLoading, setStudLoading] = useState(false);

  const [marks, setMarks]   = useState({}); 
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [err,    setErr]    = useState("");

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
    setStudents([]);
    setMarks({});
    setSaved(false);
    setErr("");
  }

  function handleSectionChange(e) {
    setSection(e.target.value);
    setStudents([]);
    setMarks({});
    setSaved(false);
    setErr("");
  }

  useEffect(() => {
    if (!section) return;
    setStudLoading(true);
    const q = query(collection(db, "users"), where("role", "==", "student"), where("section", "==", section));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
      list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setStudents(list);
      const initial = {};
      list.forEach((s) => { initial[s.uid] = "present"; });
      setMarks(initial);
      setStudLoading(false);
    });
    return unsub;
  }, [section]);

  function toggle(uid) {
    setMarks((prev) => ({ ...prev, [uid]: prev[uid] === "present" ? "absent" : "present" }));
    setSaved(false);
  }

  function markAll(status) {
    const next = {};
    students.forEach((s) => { next[s.uid] = status; });
    setMarks(next);
    setSaved(false);
  }

  async function handleSave() {
    if (!subject) return setErr("Select a subject.");
    if (!section) return setErr("Select a section.");
    if (students.length === 0) return setErr("No students found in this section.");
    setErr("");
    setSaving(true);

    const sessionId = `manual_${currentUser.uid}_${Date.now()}`;
    const displayDate = formatSafeDate(date);

    try {
      const existing = await getDocs(
        query(
          collection(db, "attendance"),
          where("method", "==", "manual"),
          where("subject", "==", subject),
          where("section", "==", section),
          where("date", "==", displayDate)
        )
      );
      const deletes = existing.docs.map((d) => deleteDoc(doc(db, "attendance", d.id)));
      await Promise.all(deletes);

      const writes = students.map((s) =>
        addDoc(collection(db, "attendance"), {
          studentId:   s.uid,
          studentName: s.name || "Student",
          rollNumber:  s.rollNumber || "",
          subject,
          section,
          date:        displayDate,
          timestamp:   new Date().toISOString(),
          sessionId,
          teacherId:   currentUser.uid,
          method:      "manual",
          status:      marks[s.uid] ?? "absent",
          markedBy:    currentUser.uid,
          markedByName: userProfile?.name || "Teacher",
          createdAt:   serverTimestamp(),
        })
      );
      await Promise.all(writes);
      setSaved(true);
    } catch (e) {
      setErr(`Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  const presentCount = Object.values(marks).filter((v) => v === "present").length;
  const absentCount  = students.length - presentCount;

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 mb-6 transition-colors">
        <ChevronLeft size={16} /> Back to Dashboard
      </button>

      <div className="glass-card p-6 mb-5">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)" }}>
            <ClipboardCheck size={20} className="text-indigo-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-100">Manual Attendance</p>
            <p className="text-xs text-slate-400">Mark each student present or absent</p>
          </div>
        </div>

        {ttLoading ? (
          <p className="text-sm text-slate-500 py-2">Loading your timetable…</p>
        ) : timetableEntries.length === 0 ? (
          <div className="flex flex-col items-center text-center gap-3 py-6">
            <Calendar size={28} className="text-amber-400" />
            <p className="text-slate-200 font-medium">No timetable set up yet</p>
            <p className="text-xs text-slate-400">Add your class schedule first so you can mark attendance.</p>
            <Link to="/teacher/timetable" className="text-sm text-indigo-400 hover:text-indigo-300 underline transition-colors">
              Go to Timetable →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 overflow-visible relative z-20">
            <div className="relative z-30">
              <label className="block text-xs text-slate-400 mb-1.5">Subject</label>
              <FluidDropdown
                options={subjects.map(s => ({ id: s, label: s, icon: BookOpen, color: "#a78bfa" }))}
                value={subject}
                onChange={val => handleSubjectChange({ target: { value: val } })}
                placeholder="— Select subject —"
              />
            </div>
            <div className="relative z-20">
              <label className="block text-xs text-slate-400 mb-1.5">Section</label>
              <FluidDropdown
                options={sections.map(s => ({ id: s, label: s, icon: Layers, color: "#38bdf8" }))}
                value={section}
                onChange={val => handleSectionChange({ target: { value: val } })}
                placeholder={subject ? "— Select section —" : "— Pick subject first —"}
                disabled={!subject}
              />
            </div>
            <div className="relative z-10">
              <label className="block text-xs text-slate-400 mb-1.5">Date</label>
              <input type="date" value={date} onChange={(e) => { setDate(e.target.value); setSaved(false); }} className="input-dark py-2" style={{ colorScheme: "dark" }} />
            </div>
          </div>
        )}
      </div>

      {section && (
        <div className="glass-card overflow-hidden mb-5">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <Users size={15} className="text-slate-400" />
              <span className="text-sm font-semibold text-slate-200">
                {studLoading ? "Loading students…" : `${students.length} student${students.length !== 1 ? "s" : ""} in ${section}`}
              </span>
            </div>
            {!studLoading && students.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 mr-2">{presentCount}P · {absentCount}A</span>
                <button onClick={() => markAll("present")} className="text-xs px-2.5 py-1 rounded-lg font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors">All Present</button>
                <button onClick={() => markAll("absent")} className="text-xs px-2.5 py-1 rounded-lg font-medium text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors">All Absent</button>
              </div>
            )}
          </div>
          {studLoading ? (
            <div className="py-8 text-center text-sm text-slate-500">Loading…</div>
          ) : students.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">No students found.</div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {students.map((s, idx) => {
                const isPresent = marks[s.uid] === "present";
                return (
                  <div key={s.uid} className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs text-slate-600 w-6 shrink-0">{idx + 1}.</span>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white" style={{ background: isPresent ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.2)" }}>
                        {s.name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-200 truncate">{s.name}</p>
                        {s.rollNumber && <p className="text-xs text-slate-500 truncate">{s.rollNumber}</p>}
                      </div>
                    </div>
                    <button onClick={() => toggle(s.uid)} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all duration-150"
                      style={isPresent ? { background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", color: "#34d399" } : { background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}
                    >
                      {isPresent ? <><Check size={13} /> Present</> : <><X size={13} /> Absent</>}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {section && students.length > 0 && (
        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            {err && <p className="text-sm text-red-400">{err}</p>}
            {saved && <p className="text-sm text-emerald-400 flex items-center gap-1.5"><Check size={15} /> Attendance saved</p>}
            {!err && !saved && <p className="text-xs text-slate-500">{presentCount} present · {absentCount} absent</p>}
          </div>
          <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ width: "auto", padding: "0.6rem 2rem", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Saving…" : "Save Attendance"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Dashboard View Component ──────────────────────────────────────────────────
function DashboardView({ onManual }) {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [attendance, setAttendance] = useState([]);
  const [studentsBySection, setStudentsBySection] = useState({});
  const [loading, setLoading] = useState(true);

  // Drilldown Modal State
  const [selectedClass, setSelectedClass] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMode, setFilterMode] = useState("all");

  const [timetable, setTimetable] = useState([]);

  const todayStr = new Date().toLocaleDateString("en-IN");
  const todayName = new Date().toLocaleDateString("en-US", { weekday: "long" });

  // Fetch timetable for pending classes
  useEffect(() => {
    if (!currentUser) return;
    const unsub = onSnapshot(query(collection(db, "timetable"), where("teacherUid", "==", currentUser.uid)), (snap) => {
      setTimetable(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [currentUser]);

  // Fetch all students (grouped by section) to calculate true rosters & absentee counts for QR
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "users"), where("role", "==", "student")), (snap) => {
      const bySec = {};
      snap.forEach(d => {
        const s = { uid: d.id, ...d.data() };
        if (!s.section) return;
        if (!bySec[s.section]) bySec[s.section] = [];
        bySec[s.section].push(s);
      });
      setStudentsBySection(bySec);
    });
    return unsub;
  }, []);

  // Fetch all attendance mapped to this teacher
  useEffect(() => {
    if (!currentUser) return;
    const unsub = onSnapshot(query(collection(db, "attendance"), where("teacherId", "==", currentUser.uid)), (snap) => {
      setAttendance(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [currentUser]);

  // Aggregate into finalClasses
  const finalClasses = useMemo(() => {
    const aggregated = {};
    attendance.forEach(record => {
      if (!aggregated[record.sessionId]) {
        aggregated[record.sessionId] = {
          sessionId: record.sessionId,
          subject: record.subject,
          section: record.section,
          date: record.date,
          method: record.method,
          earliestTime: record.timestamp,
          presentDocs: [],
          manualAbsents: []
        };
      }
      if (record.timestamp < aggregated[record.sessionId].earliestTime) {
        aggregated[record.sessionId].earliestTime = record.timestamp;
      }
      if (record.status === "present") aggregated[record.sessionId].presentDocs.push(record);
      else if (record.status === "absent") aggregated[record.sessionId].manualAbsents.push(record);
    });

    return Object.values(aggregated).map(cls => {
      const sectionStudents = studentsBySection[cls.section] || [];
      const total = sectionStudents.length;

      const presentUids = new Set(cls.presentDocs.map(d => d.studentId));
      const roster = sectionStudents.map(student => {
        const isPresent = presentUids.has(student.uid);
        const record = cls.presentDocs.find(d => d.studentId === student.uid) || cls.manualAbsents.find(d => d.studentId === student.uid);
        return {
          ...student,
          status: isPresent ? "present" : "absent",
          method: isPresent ? (record?.method || cls.method) : "none",
          timestamp: record?.timestamp || "-"
        };
      });

      // Sort roster alphabetically
      roster.sort((a,b) => (a.name||"").localeCompare(b.name||""));

      const presentCount = cls.presentDocs.length;
      const absentCount = total > 0 ? (total - presentCount) : cls.manualAbsents.length; // fallback if section empty

      return {
        ...cls,
        total,
        presentCount,
        absentCount,
        percent: total > 0 ? Math.round((presentCount / total) * 100) : 0,
        roster
      };
    });
  }, [attendance, studentsBySection]);

  // Derived Stats
  const todayClasses = finalClasses.filter(c => c.date === todayStr).sort((a,b) => b.earliestTime.localeCompare(a.earliestTime));
  const totalClassesToday = todayClasses.length;
  const totalPresentToday = todayClasses.reduce((sum, c) => sum + c.presentCount, 0);
  const totalAbsentToday = todayClasses.reduce((sum, c) => sum + c.absentCount, 0);
  const avgAttendance = (totalPresentToday + totalAbsentToday) > 0 
    ? Math.round((totalPresentToday / (totalPresentToday + totalAbsentToday)) * 100) 
    : 0;

  const avgAttColor = avgAttendance >= 90 ? "#34d399" : (avgAttendance >= 80 ? "#f97316" : "#ef4444");

  const pendingClasses = useMemo(() => {
    const ttToday = timetable.filter(t => t.day === todayName);
    return ttToday.filter(tt => !todayClasses.some(c => c.subject === tt.subject && c.section === tt.section));
  }, [timetable, todayClasses, todayName]);

  // Weekly Data for Recharts
  const weeklyData = useMemo(() => {
    const past7Days = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toLocaleDateString("en-IN");
    }).reverse();

    return past7Days.map(dateStr => {
      const classesOnDay = finalClasses.filter(c => c.date === dateStr);
      const pr = classesOnDay.reduce((sum, c) => sum + c.presentCount, 0);
      const tt = classesOnDay.reduce((sum, c) => sum + (+c.total || pr + c.absentCount), 0);
      
      const parts = dateStr.split("/");
      const dObj = parts.length === 3 ? new Date(`${parts[2]}-${parts[1]}-${parts[0]}`) : new Date();
      const dayName = dObj.toLocaleDateString("en-US", { weekday: "short" });

      return {
        day: dayName,
        percent: tt > 0 ? Math.round((pr / tt) * 100) : 0,
        fullDate: dateStr
      };
    });
  }, [finalClasses]);

  function handleDownloadCSV() {
    let csv = "Session Subject,Section,Student Name,Student ID,Status,Method,Timestamp\n";
    todayClasses.forEach(cls => {
      cls.roster.forEach(student => {
        csv += `"${cls.subject}","${cls.section}","${student.name}","${student.rollNumber || student.uid}","${student.status}","${student.method}","${student.timestamp}"\n`;
      });
    });
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Attendance_${todayStr.replace(/\//g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Mini components
  const StatCard = ({ title, value, sub, color }) => (
    <div className="glass-card p-5">
      <p className="text-xs text-slate-400 mb-1">{title}</p>
      <p className="text-2xl font-bold text-slate-100" style={{ color }}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );

  function getMethodIcon(method, size=16) {
    if (method === "QR") return <QrCode size={size} title="QR Code" />;
    if (method === "manual") return <ClipboardCheck size={size} title="Manual" />;
    if (method === "face") return <Camera size={size} title="Face Recognition" />;
    if (method === "wifi") return <Wifi size={size} title="Wi-Fi" />;
    return <span className="text-slate-600">-</span>;
  }

  if (loading) return <div className="p-12 text-center text-slate-500">Loading Dashboard Data...</div>;

  return (
    <div className="space-y-8 animate-fade-in relative pb-12">
      
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-3xl font-bold text-slate-100">Live Dashboard</h1>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Live</span>
            </div>
          </div>
          <p className="text-slate-400 text-sm">Real-time attendance overview for {todayName}, {todayStr}</p>
        </div>
        
        {/* Prominent Start QR Session Button */}
        <button 
          onClick={() => navigate("/teacher/class")} 
          className="flex items-center gap-3 px-6 py-3 rounded-2xl shadow-xl hover:scale-105 transition-transform"
          style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "white", border: "1px solid rgba(255,255,255,0.2)" }}
        >
          <QrCode size={26} />
          <div className="text-left">
            <p className="text-sm font-black tracking-wide uppercase">Start QR Session</p>
            <p className="text-[10px] opacity-80">Launch live attendance</p>
          </div>
        </button>
      </div>

      {/* Secondary Actions */}
      <div className="flex flex-wrap items-center gap-3 pb-2 border-b border-white/[0.05]">
        <button onClick={() => navigate("/teacher/face-attendance")} className="px-4 py-2 rounded-xl text-xs font-semibold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors flex items-center gap-1.5">
          <Camera size={16} /> Face Recognition
        </button>
        <button onClick={onManual} className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors flex items-center gap-1.5">
          <ClipboardCheck size={16} /> Manual Method
        </button>
        <button onClick={handleDownloadCSV} className="px-4 py-2 rounded-xl text-xs font-semibold text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 transition-colors flex items-center gap-1.5">
          <Download size={16} /> Export CSV
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
         <div className="glass-card p-5">
            <p className="text-xs text-slate-400 font-semibold mb-1 uppercase tracking-wider">Classes Today</p>
            <p className="text-3xl font-black text-slate-100">{totalClassesToday}</p>
         </div>
         <div className="glass-card p-5" style={{ background: "linear-gradient(135deg, rgba(248, 113, 113, 0.05), transparent)", border: "1px solid rgba(248, 113, 113, 0.15)" }}>
            <p className="text-xs text-red-400/80 font-bold mb-1 uppercase tracking-wider">Total Absent</p>
            <p className="text-4xl font-black text-red-500">{totalAbsentToday}</p>
         </div>
         <div className="glass-card p-5" style={{ background: "linear-gradient(135deg, rgba(52, 211, 153, 0.05), transparent)", border: "1px solid rgba(52, 211, 153, 0.15)" }}>
            <p className="text-xs text-emerald-400/80 font-bold mb-1 uppercase tracking-wider">Total Present</p>
            <p className="text-4xl font-black text-emerald-400">{totalPresentToday}</p>
         </div>
         <div className="glass-card p-5">
            <p className="text-xs text-slate-400 font-semibold mb-1 uppercase tracking-wider">Avg Attendance</p>
            <p className="text-3xl font-black" style={{ color: avgAttColor }}>{avgAttendance}%</p>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Classes Summary */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Classes Pending Attendance */}
          {pendingClasses.length > 0 && (
            <div>
               <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Pending Classes to Mark</h2>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {pendingClasses.map((pc, idx) => (
                    <div key={idx} className="glass-card p-4 border border-orange-500/20 bg-orange-500/[0.02] hover:bg-orange-500/[0.05] transition-colors flex justify-between items-center group">
                       <div>
                          <p className="text-sm font-bold text-orange-200">{pc.subject}</p>
                          <p className="text-[11px] text-orange-400 mt-0.5">{pc.section} · {formatHM(pc.time)}</p>
                       </div>
                       <button onClick={() => navigate("/teacher/class")} className="text-xs bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 font-bold border border-orange-500/20 px-3 py-1.5 rounded-lg opacity-80 group-hover:opacity-100 transition-all">
                          Mark →
                       </button>
                    </div>
                  ))}
               </div>
            </div>
          )}

          {/* Today's Marked Classes List */}
          <div className="glass-card flex flex-col min-h-[350px]">
            <div className="px-6 py-4 border-b border-white/[0.06] shrink-0">
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Check size={20} className="text-emerald-400" /> Completed Classes Today
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {todayClasses.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-12">
                  <div className="w-20 h-20 mb-4 rounded-3xl bg-slate-800/50 border border-slate-700 flex items-center justify-center">
                    <Calendar size={40} className="opacity-50" />
                  </div>
                  <p className="text-lg font-semibold text-slate-300">No classes marked yet</p>
                  <p className="text-sm mt-1 max-w-sm">Tap the prominent 'Start QR Session' button above to generate a QR code and begin taking attendance.</p>
                </div>
              ) : (
                todayClasses.map(cls => {
                  const isRed = cls.percent < 75;
                  const isYellow = cls.percent >= 75 && cls.percent < 90;
                  const barColor = isRed ? "#ef4444" : (isYellow ? "#f97316" : "#10b981");

                  return (
                    <div 
                      key={cls.sessionId} 
                      onClick={() => setSelectedClass(cls)}
                      className="p-4 rounded-xl border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.06] cursor-pointer transition-all group"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-bold text-slate-200">{cls.subject} <span className="text-slate-500 font-normal ml-2">§ {cls.section}</span></p>
                          <p className="text-xs text-slate-500 mt-0.5">{formatSafeTime(cls.earliestTime)} · via {cls.method.toUpperCase()}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-bold" style={{ color: barColor }}>{cls.percent}%</span>
                          <p className="text-xs text-slate-400">{cls.presentCount} / {cls.total}</p>
                        </div>
                      </div>
                      {/* Progress Bar */}
                      <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden relative">
                        <div 
                          className="h-full absolute left-0 top-0 transition-all duration-1000"
                          style={{ width: `${cls.percent}%`, background: barColor }}
                        />
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Weekly Chart */}
        <div className="glass-card flex flex-col h-[400px]">
          <div className="px-6 py-4 border-b border-white/[0.06] shrink-0">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">7-Day Trend</h2>
          </div>
          <div className="flex-1 p-6 flex flex-col justify-center">
            <div className="w-full" style={{ height: 250, minHeight: 250 }}>
              {weeklyData && weeklyData.length > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData} margin={{ top:0, left:-25, right:0, bottom:0 }}>
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} domain={[0, 100]} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }} 
                    contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", borderRadius: "8px", fontSize: "12px", color: "#f1f5f9" }}
                    formatter={(val) => [`${val}%`, `Attendance`]}
                    labelStyle={{ color: "#94a3b8", marginBottom: "4px" }}
                  />
                  <Bar dataKey="percent" radius={[4,4,0,0]} maxBarSize={40}>
                    {weeklyData.map((entry, index) => {
                      const isMax = entry.percent === Math.max(...weeklyData.map(d => d.percent));
                      const isMin = entry.percent === Math.min(...weeklyData.map(d => d.percent));
                      let fill = "#6366f1"; // Default indigo
                      if (isMax && entry.percent > 0) fill = "#10b981"; // Green best
                      if (isMin && entry.percent > 0) fill = "#ef4444"; // Red worst
                      if (entry.percent === 0) fill = "#334155";
                      return <Cell key={`cell-${index}`} fill={fill} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              )}
            </div>
            <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500 text-center mt-4">Color Mapping applied to Extremes</p>
          </div>
        </div>
      </div>

      {/* Drill-down Modal Override Layer */}
      {selectedClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" style={{ background: "rgba(15,23,42,0.8)", backdropFilter: "blur(4px)" }}>
          <div className="glass-card w-full max-w-3xl max-h-full flex flex-col shadow-2xl animate-scale-in">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-white/[0.06] flex items-start justify-between">
              <div>
                <p className="text-xl font-bold text-slate-100">{selectedClass.subject}</p>
                <p className="text-sm text-slate-400 mt-1">Section {selectedClass.section} · {formatSafeTime(selectedClass.earliestTime)} · {selectedClass.date}</p>
              </div>
              <button onClick={() => setSelectedClass(null)} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors">
                <X size={20} />
              </button>
            </div>
            
            {/* Modal Toolbar */}
            <div className="px-6 py-4 border-b border-white/[0.06] bg-white/[0.01] flex flex-col sm:flex-row gap-4 justify-between items-center shrink-0">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input 
                  type="text" 
                  placeholder="Search student..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-colors"
                />
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto p-1 bg-slate-900/30 rounded-xl border border-white/[0.05]">
                <button onClick={() => setFilterMode("all")} className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filterMode === "all" ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-300"}`}>All</button>
                <button onClick={() => setFilterMode("present")} className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filterMode === "present" ? "bg-emerald-500/20 text-emerald-400" : "text-slate-400 hover:text-slate-300"}`}>Present</button>
                <button onClick={() => setFilterMode("absent")} className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filterMode === "absent" ? "bg-red-500/20 text-red-400" : "text-slate-400 hover:text-slate-300"}`}>Absent</button>
              </div>
            </div>

            {/* Modal List */}
            <div className="flex-1 overflow-y-auto p-2">
              {selectedClass.roster.filter(s => {
                if (filterMode !== "all" && s.status !== filterMode) return false;
                if (searchTerm) {
                  const q = searchTerm.toLowerCase();
                  if (!s.name?.toLowerCase().includes(q) && !s.rollNumber?.toLowerCase().includes(q)) return false;
                }
                return true;
              }).map((student, i) => (
                <div key={student.uid} className="flex items-center justify-between px-4 py-3 mx-2 my-1 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                  <div className="flex items-center gap-4 min-w-0">
                    <span className="text-xs font-semibold text-slate-500 w-5">{i+1}.</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-200 truncate">{student.name}</p>
                      <p className="text-xs text-slate-500 truncate">{student.rollNumber || student.uid}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-xs text-slate-400 flex flex-col items-end hidden sm:flex">
                      <span className="flex items-center gap-1.5">{getMethodIcon(student.method)} {student.method !== "none" ? student.method.toUpperCase() : ""}</span>
                      <span>{formatSafeTime(student.timestamp)}</span>
                    </div>
                    <span 
                      className="px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-widest border"
                      style={{
                        background: student.status === "present" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                        borderColor: student.status === "present" ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)",
                        color: student.status === "present" ? "#34d399" : "#f87171"
                      }}
                    >
                      {student.status}
                    </span>
                  </div>
                </div>
              ))}
              {selectedClass.roster.length === 0 && (
                <div className="py-12 text-center text-slate-500">No students have marked attendance yet.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────
export default function AttendancePage() {
  useTitle("Attendance");
  const [mode, setMode] = useState(null); // null | "manual"

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto h-full flex flex-col">
      {mode === null && <DashboardView onManual={() => setMode("manual")} />}
      {mode === "manual" && <ManualAttendance onBack={() => setMode(null)} />}
    </div>
  );
}
