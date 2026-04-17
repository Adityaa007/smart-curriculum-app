import useTitle from "../hooks/useTitle";
import React, { useState, useEffect, useMemo } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { Calendar, AlertCircle, ClipboardCheck, QrCode, Camera, Wifi, ChevronLeft, ChevronRight, Sparkles, Flame, ShieldCheck, Check, X, BookOpen, SlidersHorizontal } from "lucide-react";
import { FluidDropdown } from "../components/ui/FluidDropdown";
import { BackButton } from "../components/ui/back-button";
import { formatSafeTime, formatSafeDate, formatHM } from "../lib/dateUtils";

// ── Helpers ──────────────────────────────────────────────────
function getMethodIcon(method, size=16) {
  if (method === "QR") return <QrCode size={size} title="QR Code" />;
  if (method === "manual") return <ClipboardCheck size={size} title="Manual" />;
  if (method === "face") return <Camera size={size} title="Face Recognition" />;
  if (method === "wifi") return <Wifi size={size} title="Wi-Fi" />;
  return <span className="text-slate-600">-</span>;
}

function parseDate(dateStr) {
  if (!dateStr) return new Date();
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [d, m, y] = parts;
    return new Date(`${y}-${m}-${d}`);
  }
  return new Date(dateStr);
}

// ── Circular Ring Widget ───────────────────────────────────────
function CircularProgress({ percent }) {
  const [p, setP] = useState(0);
  useEffect(() => {
    // animate on load
    const t = setTimeout(() => setP(percent), 100);
    return () => clearTimeout(t);
  }, [percent]);

  const r = 45;
  const circ = 2 * Math.PI * r;
  const offset = circ - (p / 100) * circ;
  const color = p >= 75 ? "#10b981" : p >= 65 ? "#f59e0b" : "#ef4444";

  return (
    <div className="flex flex-col items-center">
      <svg width="120" height="120" className="circular-progress -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
        <circle
          cx="60" cy="60" r={r}
          fill="none" stroke={color} strokeWidth="8"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s ease-out, stroke 0.5s" }}
        />
      </svg>
      <div className="mt-[-78px] mb-8 flex flex-col items-center">
        <span className="text-2xl font-bold text-slate-100">{p}%</span>
        <span className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">Overall</span>
      </div>
    </div>
  );
}

// ── Main Page Component ────────────────────────────────────────
export default function StudentAttendance() {
  useTitle("My Attendance");
  const { currentUser, userProfile } = useAuth();
  
  const [attendance, setAttendance] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [loading, setLoading] = useState(true);

  // UI State
  const [expandedSubject, setExpandedSubject] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  // Table filters
  const [filterSubject, setFilterSubject] = useState("");
  const [filterMethod, setFilterMethod] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch Data
  useEffect(() => {
    if (!currentUser) return;
    const uAtt = onSnapshot(query(collection(db, "attendance"), where("studentId", "==", currentUser.uid)), (s) => setAttendance(s.docs.map(d=>d.data())));
    const uSes = onSnapshot(query(collection(db, "sessions"), where("section", "==", userProfile?.section || "")), (s) => setSessions(s.docs.map(d=>d.data())));
    const uTim = onSnapshot(query(collection(db, "timetable"), where("section", "==", userProfile?.section || "")), (s) => {
      setTimetable(s.docs.map(d=>d.data()));
      setLoading(false);
    });
    return () => { uAtt(); uSes(); uTim(); };
  }, [currentUser, userProfile]);

  // Master Merge Logic
  const history = useMemo(() => {
    const list = [];
    const attSet = new Set();

    // 1. Add all explicit attendance (Manual + QR Present)
    attendance.forEach(a => {
      attSet.add(a.sessionId);
      list.push(a);
    });

    // 2. Add implied absences from QR sessions
    sessions.forEach(s => {
      if (!attSet.has(s.sessionId)) {
        list.push({
          sessionId: s.sessionId,
          subject: s.subject,
          section: s.section,
          date: s.date,
          status: "absent",
          method: "none",
          timestamp: s.createdAt?.toDate?.().toISOString() || new Date(parseDate(s.date)).toISOString()
        });
      }
    });

    // Sort descending by timestamp
    return list.sort((a,b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
  }, [attendance, sessions]);

  // Global Stats
  const { overallPercent, totalAttended, totalClasses, streak, subjectStats } = useMemo(() => {
    let totAtt = 0;
    
    // Group by subject
    const subjMap = {};
    // Seed subjects from timetable
    timetable.forEach(t => {
      if (!subjMap[t.subject]) subjMap[t.subject] = { name: t.subject, held: 0, attended: 0, dates: [] };
    });

    const dateMap = {}; // for streak

    history.forEach(h => {
      if (h.status === "present") totAtt++;
      if (!subjMap[h.subject]) subjMap[h.subject] = { name: h.subject, held: 0, attended: 0, dates: [] };
      subjMap[h.subject].held++;
      if (h.status === "present") subjMap[h.subject].attended++;

      // Build dateMap
      if (!dateMap[h.date]) dateMap[h.date] = { total: 0, present: 0 };
      dateMap[h.date].total++;
      if (h.status === "present") dateMap[h.date].present++;
    });

    const total = history.length;
    const ovP = total > 0 ? Math.round((totAtt / total) * 100) : 100;

    // Streak Calculation
    let currentStreak = 0;
    const sortedDates = Object.keys(dateMap).sort((a,b) => parseDate(b) - parseDate(a));
    for (const d of sortedDates) {
      if (dateMap[d].present > 0) {
        currentStreak++;
      } else {
        // Full absent day breaks streak
        break;
      }
    }

    // Map subject stats formatting
    const sStats = Object.values(subjMap).map(s => {
      const p = s.held > 0 ? Math.round((s.attended / s.held) * 100) : 100;
      let status = "Safe";
      if (p < 65) status = "Danger";
      else if (p < 75) status = "At Risk";
      return { ...s, percent: p, badge: status };
    });

    return { overallPercent: ovP, totalAttended: totAtt, totalClasses: total, streak: currentStreak, subjectStats: sStats };
  }, [history, timetable]);

  // Low Attendance Warning Math
  const warnings = useMemo(() => {
    const list = [];
    subjectStats.forEach(s => {
      if (s.percent < 75 && s.held > 0) {
        // N = ceil((0.75 * T - A) / 0.25)
        const needed = Math.ceil((0.75 * s.held - s.attended) / 0.25);
        if (needed > 0) {
           list.push({ subject: s.name, percent: s.percent, needed });
        }
      }
    });
    return list;
  }, [subjectStats]);

  // Upcoming Classes & Next Class Logic
  const { nextClass, upcomingClasses } = useMemo(() => {
    const daysArr = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const d = new Date();
    const tName = daysArr[d.getDay()];
    d.setDate(d.getDate() + 1);
    const tmName = daysArr[d.getDay()];

    const todayLst = timetable.filter(t => t.day === tName).sort((a,b)=>a.startTime.localeCompare(b.startTime));
    const tmrrLst = timetable.filter(t => t.day === tmName).sort((a,b)=>a.startTime.localeCompare(b.startTime));

    const now = new Date();
    const futureToday = todayLst.filter(c => {
       if(!c.endTime) return true;
       const [h, m] = c.endTime.split(":");
       const end = new Date(); end.setHours(+h,+m,0);
       return end > now;
    });

    const upcoming = [
       { label: "Today", list: futureToday },
       { label: "Tomorrow", list: tmrrLst }
    ];

    const nextOne = futureToday.length > 0 ? futureToday[0] : null;
    return { nextClass: nextOne, upcomingClasses: upcoming };
  }, [timetable]);

  const nextClassImpact = useMemo(() => {
    const nextAtt = Math.round(((totalAttended + 1) / (totalClasses + 1)) * 100);
    const nextMiss = Math.round((totalAttended / (totalClasses + 1)) * 100);
    return { nextAtt, nextMiss };
  }, [totalAttended, totalClasses]);

  // Table Pagination & Filter
  const filteredHistory = history.filter(h => {
    if (filterSubject && h.subject !== filterSubject) return false;
    if (filterMethod && h.method !== filterMethod) {
      if (filterMethod === "none" && h.method !== "none") return false;
      if (filterMethod !== "none" && h.method !== filterMethod) return false;
    }
    return true;
  });
  const totalPages = Math.ceil(filteredHistory.length / 20) || 1;
  const tableSlice = filteredHistory.slice((currentPage - 1) * 20, currentPage * 20);

  if (loading) return <div className="p-12 text-center text-slate-500">Loading your attendance universe...</div>;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto h-full space-y-6 animate-fade-in pb-12">
      
      {/* Header */}
      <div className="mb-4 flex items-center gap-4">
        <BackButton />
        <div>
          <h1 className="text-2xl font-bold text-slate-100">My Attendance</h1>
          <p className="text-slate-400 text-sm">Monitor your academic presence and streak in real time.</p>
        </div>
      </div>

      {/* Smart Attendance Insight */}
      {totalClasses > 0 && (
        <div className={`glass-card mb-4 p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 animate-fade-in transition-colors duration-500 ${
          overallPercent < 75 ? 'bg-red-500/5 border-red-500/20' : 'bg-emerald-500/5 border-emerald-500/20'
        }`}>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 border transition-colors duration-500 ${
               overallPercent < 75 ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            }`}>
              {overallPercent < 75 ? <AlertCircle size={24} /> : <Check size={24} />}
            </div>
            <div>
              <h2 className={`text-lg font-bold transition-colors duration-500 ${overallPercent < 75 ? 'text-red-100' : 'text-emerald-100'}`}>
                {overallPercent < 75 ? `Low Attendance: ${overallPercent}%` : `You are in safe zone (${overallPercent}%)`}
              </h2>
              <p className={`text-sm mt-0.5 transition-colors duration-500 ${overallPercent < 75 ? 'text-red-300' : 'text-emerald-500/80'}`}>
                {overallPercent < 75 
                  ? `You are ${75 - overallPercent}% below safe zone` 
                  : "Maintain your attendance to stay above 75%"}
              </p>
            </div>
          </div>
          
          {overallPercent < 75 && (
            <div className="flex flex-col sm:flex-row items-stretch gap-3 w-full md:w-auto animate-fade-in">
              <div className="bg-red-950/30 border border-red-500/20 rounded-lg p-3 w-full sm:w-auto">
                <p className="text-[10px] text-red-200/70 uppercase tracking-wider font-semibold mb-1.5">Impact Scenario</p>
                <div className="flex flex-col gap-1 text-xs font-semibold mt-1">
                  <span className="text-emerald-400 flex items-center gap-1.5">If you attend next class &rarr; {Math.round(((totalAttended + 1) / (totalClasses + 1)) * 100)}%</span>
                  <span className="text-red-400 flex items-center gap-1.5">If you miss next class &rarr; {Math.round((totalAttended / (totalClasses + 1)) * 100)}%</span>
                </div>
              </div>
              
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex flex-col items-center justify-center w-full sm:w-auto shrink-0">
                <div className="text-2xl font-bold text-red-400 animate-pulse leading-none">{Math.ceil((0.75 * totalClasses - totalAttended) / 0.25)}</div>
                <div className="text-[10px] text-red-300/80 uppercase tracking-wider text-center font-semibold mt-1">Consecutive Classes<br/>Needed to reach 75%</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* NEXT CLASS ACTION HERO */}
      {nextClass && (
        <div className="mb-6 p-5 sm:p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 hover:bg-white/[0.02] transition-colors"
             style={{ border: "1px solid rgba(99,102,241,0.3)", background: "linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.05))" }}>
          <div>
            <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" /> Next Scheduled Class
            </p>
            <h2 className="text-2xl font-black text-slate-100 mb-1">{nextClass.subject}</h2>
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400 font-medium">
               <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-xs">{formatHM(nextClass.startTime)} - {formatHM(nextClass.endTime)}</span>
               {nextClass.room && <span className="text-xs">📍 {nextClass.room}</span>}
               <span className="text-xs">§ {nextClass.section}</span>
            </div>
            
            <div className="mt-4 flex gap-4 text-xs font-bold bg-slate-900/40 inline-flex px-3 py-2 rounded-lg border border-white/[0.05]">
               <span className="text-emerald-400">Attending &rarr; {nextClassImpact.nextAtt}%</span>
               <span className="text-slate-600">|</span>
               <span className="text-red-400">Missing &rarr; {nextClassImpact.nextMiss}%</span>
            </div>
          </div>
          
          <button 
            className="w-full md:w-auto px-6 py-4 rounded-xl flex items-center justify-center gap-2 font-bold shadow-lg shadow-indigo-500/10 hover:-translate-y-1 hover:shadow-indigo-500/25 transition-all text-sm"
            style={{ background: "#6366f1", color: "white" }}
          >
            <Check className="shrink-0" size={20} /> Mark me present
          </button>
        </div>
      )}

      {/* Top Summaries */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card flex items-center justify-center pt-8 pb-4 relative overflow-hidden">
           <CircularProgress percent={overallPercent} />
        </div>
        <div className="glass-card p-6 flex flex-col justify-center relative overflow-hidden group">
          <ShieldCheck size={120} className="absolute -right-8 -bottom-8 text-indigo-500/5 group-hover:text-indigo-500/10 transition-colors" />
          <p className="text-sm text-slate-400 font-semibold uppercase tracking-wider mb-2">Total Classes Attended</p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-slate-100">{totalAttended}</span>
            <span className="text-lg text-slate-500">/ {totalClasses}</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">Overall classes held in your section.</p>
        </div>
        <div className="glass-card p-6 flex flex-col justify-center relative overflow-hidden group">
          <Flame size={120} className="absolute -right-8 -bottom-8 text-amber-500/5 group-hover:text-amber-500/10 transition-colors" />
          <p className="text-sm text-slate-400 font-semibold uppercase tracking-wider mb-2">Current Streak</p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-amber-400">{streak}</span>
            <span className="text-lg text-slate-500">Days</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">Consecutive days without being fully absent.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Subject Breakdown */}
        <div className="lg:col-span-2 glass-card flex flex-col">
          <div className="px-6 py-4 border-b border-white/[0.06] shrink-0">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Subject Breakdown</h2>
          </div>
          <div className="flex-1 p-4 space-y-3">
            {subjectStats.length === 0 ? (
               <div className="py-8 text-center text-slate-500">No subjects assigned.</div>
            ) : [...subjectStats].sort((a,b) => a.percent - b.percent).map(s => {
              const bgC = s.badge === "Safe" ? "#10b981" : s.badge === "At Risk" ? "#f59e0b" : "#ef4444";
              const isExpanded = expandedSubject === s.name;

              return (
                <div key={s.name} className="p-4 rounded-xl border border-white/[0.05] bg-white/[0.02] transition-colors">
                  <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedSubject(isExpanded ? null : s.name)}>
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <p className="font-bold text-slate-200">{s.name}</p>
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md" style={{ background: `${bgC}20`, color: bgC, border: `1px solid ${bgC}30` }}>
                          {s.badge}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{s.attended} / {s.held} classes attended</p>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      <span className="text-lg font-bold" style={{ color: bgC }}>{s.percent}%</span>
                      <Calendar size={20} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180 text-indigo-400' : ''}`} />
                    </div>
                  </div>
                  
                  {/* Progress Line */}
                  <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden mt-3 relative">
                    <div className="h-full absolute left-0 top-0 transition-all duration-1000" style={{ width: `${s.percent}%`, background: bgC }} />
                  </div>

                  {/* Expanded Dates ListView */}
                  {isExpanded && (() => {
                    const subjectRecords = history.filter(record => record.subject === s.name);
                    return (
                      <div className="mt-4 pt-4 border-t border-white/[0.05] animate-fade-in">
                        {/* Legend */}
                        <div className="flex items-center gap-4 mb-3 text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                          <div className="flex items-center gap-1.5"><Check className="text-emerald-400" size={14}/> Present</div>
                          <div className="flex items-center gap-1.5"><X className="text-red-400" size={14}/> Absent</div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {subjectRecords.map((d, i) => (
                            <div 
                              key={i} 
                              title={`Date: ${d.date}\nTime: ${formatSafeTime(d.timestamp)}\nMethod: ${d.method === 'none' ? 'Missed' : d.method}`}
                              className={`flex items-center gap-2 text-xs bg-slate-900/50 p-2 rounded-lg border border-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.1] transition-all cursor-default ${i === 0 ? 'ring-1 ring-indigo-500/30 bg-indigo-500/5' : ''}`}
                            >
                              {d.status === "present" ? <Check size={20} className="text-emerald-400 shrink-0"/> : <X size={20} className="text-red-400 shrink-0"/>}
                              <span className={d.status === "present" ? "text-slate-300" : "text-slate-500"}>{formatSafeDate(d.date)}</span>
                            </div>
                          ))}
                          {subjectRecords.length === 0 && <span className="text-xs text-slate-500 col-span-full">No classes held yet.</span>}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming Classes View */}
        <div className="glass-card flex flex-col">
          <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Upcoming Schedule</h2>
            <Calendar className="text-slate-500" size={18} />
          </div>
          
          <div className="p-0 flex-1 overflow-y-auto">
             {upcomingClasses.map((group, idx) => (
                group.list.length > 0 && (
                  <div key={idx}>
                     <div className="px-5 py-2 bg-white/[0.02] border-y border-white/[0.02] text-[10px] font-bold text-slate-400 uppercase tracking-widest">{group.label}</div>
                     <div className="divide-y divide-white/[0.04]">
                        {group.list.map((c, i) => (
                           <div key={i} className="px-5 py-4 flex gap-4 hover:bg-white/[0.02] transition-colors">
                              <div className="text-xs font-medium text-slate-500 w-20 shrink-0 mt-0.5">
                                {formatHM(c.startTime)}
                              </div>
                              <div>
                                <p className="text-sm font-bold text-slate-200">{c.subject}</p>
                                <p className="text-xs text-slate-500 mt-0.5">{c.room || "—"}</p>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
                )
             ))}
             {upcomingClasses.every(g => g.list.length === 0) && (
               <div className="p-8 text-center text-slate-500 text-sm flex flex-col items-center">
                 <div className="w-12 h-12 bg-slate-800/50 rounded-2xl flex items-center justify-center mb-3">
                   <Calendar className="text-slate-600" size={24} />
                 </div>
                 No upcoming classes in the next 48 hours.
               </div>
             )}
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="glass-card flex flex-col overflow-visible">
        <div className="px-6 py-4 border-b border-white/[0.06] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 overflow-visible">
          <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Attendance Register</h2>
          <div className="flex flex-col sm:flex-row items-center gap-3 text-sm w-full sm:w-auto relative z-20">
            <div className="w-full sm:w-48 relative z-20">
              <FluidDropdown
                options={[
                  { id: "", label: "All Subjects", icon: BookOpen },
                  ...subjectStats.map(s => ({ id: s.name, label: s.name, icon: BookOpen, color: "#38bdf8" }))
                ]}
                value={filterSubject}
                onChange={val => {setFilterSubject(val); setCurrentPage(1);}}
                placeholder="All Subjects"
              />
            </div>
            <div className="w-full sm:w-44 relative z-10">
              <FluidDropdown
                options={[
                  { id: "", label: "All Methods", icon: SlidersHorizontal },
                  { id: "QR", label: "QR Code", icon: QrCode, color: "#a78bfa" },
                  { id: "manual", label: "Manual", icon: ClipboardCheck, color: "#fbbf24" },
                  { id: "none", label: "Missed", icon: X, color: "#f87171" }
                ]}
                value={filterMethod}
                onChange={val => {setFilterMethod(val); setCurrentPage(1);}}
                placeholder="All Methods"
              />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-400">
            <thead className="bg-white/[0.02] text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-white/[0.06]">
              <tr>
                <th className="px-6 py-3">Date & Time</th>
                <th className="px-6 py-3">Subject / Section</th>
                <th className="px-6 py-3 text-center">Method</th>
                <th className="px-6 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {tableSlice.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                    No attendance records found. Your attendance will appear here once your teacher starts taking attendance.
                  </td>
                </tr>
              ) : tableSlice.map((record, i) => (
                <tr key={`${record.sessionId}-${i}`} className="hover:bg-white/[0.01] transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-300 whitespace-nowrap">
                    {formatSafeDate(record.date)} <span className="text-xs text-slate-500 ml-2">{formatSafeTime(record.timestamp)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-slate-200">{record.subject}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Sec {record.section}</p>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-1.5" title={record.method}>
                       {getMethodIcon(record.method, 18)}
                       {record.method === "none" && <span className="text-[10px] uppercase font-bold text-slate-600">Missed</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span 
                      className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border"
                      style={{
                        background: record.status === "present" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                        borderColor: record.status === "present" ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)",
                        color: record.status === "present" ? "#34d399" : "#f87171"
                      }}
                    >
                      {record.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Footer */}
        {totalPages > 1 && (
           <div className="px-6 py-4 border-t border-white/[0.06] flex items-center justify-between text-xs text-slate-500">
             <span>Showing page {currentPage} of {totalPages}</span>
             <div className="flex items-center gap-2">
               <button onClick={()=>setCurrentPage(p=>Math.max(1, p-1))} disabled={currentPage===1} className="px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 disabled:opacity-50">Prev</button>
               <button onClick={()=>setCurrentPage(p=>Math.min(totalPages, p+1))} disabled={currentPage===totalPages} className="px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 disabled:opacity-50">Next</button>
             </div>
           </div>
        )}
      </div>

      {/* Motivational Section */}
      <div className="glass-card p-6 flex flex-col md:flex-row items-center gap-5 justify-center text-center md:text-left relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-10 -mt-10" />
        <div className="w-14 h-14 rounded-full flex items-center justify-center shrink-0 border"
          style={{
            background: overallPercent > 90 ? "rgba(16,185,129,0.15)" : overallPercent >= 75 ? "rgba(99,102,241,0.15)" : "rgba(239,68,68,0.15)",
            borderColor: overallPercent > 90 ? "rgba(16,185,129,0.3)" : overallPercent >= 75 ? "rgba(99,102,241,0.3)" : "rgba(239,68,68,0.3)",
            color: overallPercent > 90 ? "#34d399" : overallPercent >= 75 ? "#818cf8" : "#f87171"
          }}
        >
          {overallPercent > 90 ? <Sparkles size={28}/> : overallPercent >= 75 ? <ShieldCheck size={28}/> : <AlertCircle size={28}/>}
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-100">
            {overallPercent > 90 ? "Excellent!" : overallPercent >= 75 ? "Good job!" : "You need to improve your attendance."}
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            {overallPercent > 90 ? "You are in the top performers. Keep it up!" : overallPercent >= 75 ? "Stay consistent to maintain your attendance." : "Talk to your teacher for support and make a plan to recover your percentage."}
          </p>
        </div>
      </div>
      
    </div>
  );
}
