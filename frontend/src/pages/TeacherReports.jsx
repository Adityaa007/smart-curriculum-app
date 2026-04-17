import useTitle from "../hooks/useTitle";
import React, { useState, useEffect, useMemo } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { isIndexError } from "../lib/firestoreUtils";
import { useAuth } from "../contexts/AuthContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Download, RefreshCw, AlertCircle, Check, QrCode, Pencil, List, X, BookOpen, Layers, SlidersHorizontal } from "lucide-react";
import { FluidDropdown } from "../components/ui/FluidDropdown";
import { BackButton } from "../components/ui/back-button";
import { formatSafeTime, formatSafeDate } from "../lib/dateUtils";

// Default Date Range Calculation (Last 30 Days)
const getThirtyDaysAgo = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
};
const getToday = () => new Date().toISOString().split("T")[0];

export default function TeacherReports() {
  useTitle("Reports");
  const { currentUser } = useAuth();
  
  // ── 1. Data States ───────────────────────────────────────────────────────
  const [sessions, setSessions] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [indexBuilding, setIndexBuilding] = useState(false);

  // ── 2. Filter States ─────────────────────────────────────────────────────
  const [dateFrom, setDateFrom] = useState(getThirtyDaysAgo());
  const [dateTo, setDateTo] = useState(getToday());
  const [subject, setSubject] = useState("");
  const [section, setSection] = useState("");
  const [status, setStatus] = useState("");
  const [method, setMethod] = useState("");

  // ── 3. UI States ─────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("report"); // report | summary | defaulters
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 25;

  // ── Fetch Global Real-Time Data ──────────────────────────────────────────
  useEffect(() => {
    if (!currentUser) return;

    let sList = [], aList = [], uList = [];
    let sLoaded = false, aLoaded = false, uLoaded = false;
    
    const checkDone = () => { if (sLoaded && aLoaded && uLoaded) setLoading(false); };

    const qs = query(collection(db, "sessions"), where("teacherId", "==", currentUser.uid));
    const unsubS = onSnapshot(qs, snap => {
      sList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setSessions(sList);
      sLoaded = true; checkDone();
      setIndexBuilding(false);
    }, (err) => {
      console.error("Sessions Snapshot Error:", err);
      if (isIndexError(err)) setIndexBuilding(true);
    });

    const qa = query(collection(db, "attendance"), where("teacherId", "==", currentUser.uid));
    const unsubA = onSnapshot(qa, snap => {
      aList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAttendance(aList);
      aLoaded = true; checkDone();
      setIndexBuilding(false);
    }, (err) => {
      console.error("Attendance Snapshot Error:", err);
      if (isIndexError(err)) setIndexBuilding(true);
    });

    const qu = query(collection(db, "users"), where("role", "==", "student"));
    const unsubU = onSnapshot(qu, snap => {
      uList = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
      setUsers(uList);
      uLoaded = true; checkDone();
    });

    return () => { unsubS(); unsubA(); unsubU(); };
  }, [currentUser]);

  // ── Pre-Filter Extractors ────────────────────────────────────────────────
  const uniqueSubjects = useMemo(() => [...new Set(sessions.map(s => s.subject))].sort(), [sessions]);
  const uniqueSections = useMemo(() => {
    const relevant = subject ? sessions.filter(s => s.subject === subject) : sessions;
    return [...new Set(relevant.map(s => s.section))].sort();
  }, [sessions, subject]);

  // ── Core Aggregation Engine (O(n) Map-Based Lookup) ──────────────────────
  const engine = useMemo(() => {
    // 1. Filter sessions efficiently BEFORE processing any nested logic
    const filteredSessions = sessions.filter(s => {
      if (subject && s.subject !== subject) return false;
      if (section && s.section !== section) return false;
      
      const sDate = new Date(s.timestamp || s.date);
      if (dateFrom && sDate < new Date(dateFrom)) return false;
      if (dateTo && sDate > new Date(dateTo + "T23:59:59")) return false;
      return true;
    });

    // 2. Build Indexed Maps (O(1) lookups)
    const attendanceMap = new Map(); 
    const explicitRecordsMap = new Map(); 

    attendance.forEach(a => {
      if (!attendanceMap.has(a.sessionId)) attendanceMap.set(a.sessionId, new Set());
      attendanceMap.get(a.sessionId).add(a.studentId);
      explicitRecordsMap.set(`${a.sessionId}_${a.studentId}`, a);
    });

    const sectionStudentsMap = new Map();
    users.forEach(u => {
      if (!sectionStudentsMap.has(u.section)) sectionStudentsMap.set(u.section, []);
      sectionStudentsMap.get(u.section).push(u);
    });

    // 3. Generate Master Records array
    const masterList = [];
    
    filteredSessions.forEach(sess => {
      const sectionStuds = sectionStudentsMap.get(sess.section) || [];
      const presentStuds = attendanceMap.get(sess.sessionId) || new Set();

      sectionStuds.forEach(stud => {
        const key = `${sess.sessionId}_${stud.uid}`;
        const explicitRec = explicitRecordsMap.get(key);

        if (explicitRec) {
          masterList.push({
            ...explicitRec,
            studentName: explicitRec.studentName || stud.name,
            rollNumber: explicitRec.rollNumber || stud.rollNumber
          });
        } else {
          masterList.push({
            id: `synth_${sess.sessionId}_${stud.uid}`,
            studentId: stud.uid,
            studentName: stud.name,
            rollNumber: stud.rollNumber,
            subject: sess.subject,
            section: sess.section,
            date: sess.date, 
            timestamp: sess.timestamp,
            sessionId: sess.sessionId,
            method: "Missed",
            status: "absent",
          });
        }
      });
    });

    // 4. Apply Secondary Filters (Status & Method)
    const fullyFilteredList = masterList.filter(r => {
      if (status && r.status !== status) return false;
      if (method && r.method !== method) return false;
      return true;
    });

    // 5. Chronological sort descending
    fullyFilteredList.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

    // 6. Calculate Top-Level Summaries
    const totalClasses = filteredSessions.length;
    let totalP = 0, totalA = 0;
    const studentAbsenceCount = {};
    const studentPresenceCount = {};

    masterList.forEach(r => {
      if (r.status === "present") {
        totalP++;
        studentPresenceCount[r.studentName] = (studentPresenceCount[r.studentName] || 0) + 1;
      } else {
        totalA++;
        studentAbsenceCount[r.studentName] = (studentAbsenceCount[r.studentName] || 0) + 1;
      }
    });

    const overallPercent = (totalP + totalA) > 0 ? ((totalP / (totalP + totalA)) * 100).toFixed(1) : 0;
    
    const mostAbsent = Object.entries(studentAbsenceCount).sort((a,b) => b[1] - a[1])[0];
    const bestAttending = Object.entries(studentPresenceCount).sort((a,b) => b[1] - a[1])[0];

    // 7. Generate Student Summary array
    const studentSummaryObj = {};
    masterList.forEach(r => {
      if (!studentSummaryObj[r.studentId]) {
        studentSummaryObj[r.studentId] = {
          studentId: r.studentId,
          name: r.studentName,
          rollNumber: r.rollNumber,
          section: r.section,
          totalHeld: 0,
          attended: 0,
          missed: 0
        };
      }
      studentSummaryObj[r.studentId].totalHeld++;
      if (r.status === "present") studentSummaryObj[r.studentId].attended++;
      else studentSummaryObj[r.studentId].missed++;
    });

    const studentSummaryArray = Object.values(studentSummaryObj).map(s => {
      const percentage = s.totalHeld === 0 ? 0 : (s.attended / s.totalHeld) * 100;
      return { ...s, percentage };
    }).sort((a,b) => a.percentage - b.percentage);

    // 8. Generate Defaulters List
    const defaultersList = studentSummaryArray.filter(s => s.percentage < 74.999);

    return {
      masterList: fullyFilteredList, 
      studentSummary: studentSummaryArray,
      defaulters: defaultersList,
      summaries: {
        totalClasses, totalP, totalA, overallPercent,
        mostAbsent: mostAbsent ? `${mostAbsent[0]} (${mostAbsent[1]}x)` : "None",
        bestAttending: bestAttending ? `${bestAttending[0]} (${bestAttending[1]}x)` : "None"
      }
    };
  }, [sessions, attendance, users, subject, section, dateFrom, dateTo, status, method]);

  // ── Pagination Mechanics ─────────────────────────────────────────────────
  const { masterList, studentSummary, defaulters, summaries } = engine;
  
  let currentArray = [];
  if (activeTab === "report") currentArray = masterList;
  else if (activeTab === "summary") currentArray = studentSummary;
  else if (activeTab === "defaulters") currentArray = defaulters;

  const totalPages = Math.ceil(currentArray.length / rowsPerPage) || 1;
  const tableSlice = currentArray.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  useEffect(() => setCurrentPage(1), [activeTab]);

  // ── Export Formats ───────────────────────────────────────────────────────
  const exportCSV = () => {
    let headers = [];
    let rows = [];

    if (activeTab === "report") {
      headers = ["Student Name", "Roll No", "Subject", "Section", "Date", "Time", "Status", "Method"];
      rows = currentArray.map(r => [
        `"${r.studentName}"`, `"${r.rollNumber || ""}"`, `"${r.subject}"`, `"${r.section}"`, 
        `"${r.date}"`, `"${new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}"`,
        `"${r.status}"`, `"${r.method}"`
      ]);
    } else if (activeTab === "summary") {
      headers = ["Student Name", "Roll No", "Section", "Held", "Attended", "Missed", "Percentage"];
      rows = currentArray.map(s => [
        `"${s.name}"`, `"${s.rollNumber || ""}"`, `"${s.section}"`, 
        s.totalHeld, s.attended, s.missed, `${s.percentage.toFixed(1)}%`
      ]);
    } else {
      headers = ["Student Name", "Roll No", "Section", "Current %", "Classes Needed"];
      rows = currentArray.map(s => [
        `"${s.name}"`, `"${s.rollNumber || ""}"`, `"${s.section}"`, 
        `${s.percentage.toFixed(1)}%`, Math.max(0, Math.ceil((3 * s.totalHeld) - (4 * s.attended)))
      ]);
    }

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `attendance_${activeTab}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPDF = () => {
    if (currentArray.length > 500 && !window.confirm("Over 500 records. Proceed?")) return;
    
    const doc = new jsPDF(activeTab === "report" ? "l" : "p", "mm", "a4");
    
    doc.setFontSize(18);
    doc.text(`SmartCurriculum: Attendance Report`, 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Filters: Subj: ${subject||"All"}, Sec: ${section||"All"}, Range: ${dateFrom} to ${dateTo}`, 14, 28);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 34);

    let head = [], body = [];
    if (activeTab === "report") {
      head = [["Name", "ID", "Subject", "Sec", "Date", "Time", "Status", "Method"]];
      body = currentArray.map(r => [
        r.studentName, r.rollNumber || "-", r.subject, r.section, r.date,
        new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        r.status.toUpperCase(), r.method
      ]);
    } else if (activeTab === "summary") {
      head = [["Name", "ID", "Sec", "Held", "Attended", "Missed", "Perc (%)"]];
      body = currentArray.map(s => [
        s.name, s.rollNumber || "-", s.section, s.totalHeld, s.attended, s.missed, s.percentage.toFixed(1) + "%"
      ]);
    } else {
      head = [["Name", "ID", "Sec", "Current %", "Needed for 75%"]];
      body = currentArray.map(s => [
        s.name, s.rollNumber || "-", s.section, s.percentage.toFixed(1) + "%",
        Math.max(0, Math.ceil((3 * s.totalHeld) - (4 * s.attended))).toString()
      ]);
    }

    autoTable(doc, { startY: 40, head, body, theme: "grid", styles: { fontSize: 8 }, headStyles: { fillColor: [99, 102, 241] } });
    doc.save(`attendance_${activeTab}_report.pdf`);
  };

  if (loading) return <div className="p-12 text-center text-slate-500">Loading analytics engine...</div>;

  if (indexBuilding) {
    return (
      <div className="p-10 flex flex-col items-center justify-center min-h-[400px] text-center gap-4 animate-fade-in shadow-xl bg-slate-800/20">
        <div className="w-16 h-16 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
        <div>
          <h2 className="text-xl font-bold text-slate-100">Preparing reports...</h2>
          <p className="text-slate-400 text-sm mt-1 max-w-sm">
            We're setting up the necessary connections to fetch your attendance data. Please wait a moment.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 animate-fade-in pb-12">
      <div className="flex justify-between items-end">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Attendance Reports</h1>
            <p className="text-slate-400 text-sm mt-1">Cross-reference explicitly scanned and synthetically verified records.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={exportCSV} className="btn-secondary flex items-center gap-2 py-2 text-sm"><List size={20} /> CSV</button>
          <button onClick={exportPDF} className="btn-primary flex items-center gap-2 py-2 text-sm"><Download size={20} /> PDF</button>
        </div>
      </div>

      {/* Global Filter Toolbar */}
      <div className="relative glass-card p-5 flex flex-wrap gap-4 no-print overflow-visible z-20">
        <div>
          <label className="block text-xs text-slate-400 mb-1.5 font-semibold">DATE FROM</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input-dark w-40 text-sm py-2"/>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1.5 font-semibold">DATE TO</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input-dark w-40 text-sm py-2"/>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1.5 font-semibold">SUBJECT</label>
          <div className="w-48 relative z-30">
            <FluidDropdown
              options={[
                { id: "", label: "All Subjects", icon: BookOpen },
                ...uniqueSubjects.map(s => ({ id: s, label: s, icon: BookOpen, color: "#a78bfa" }))
              ]}
              value={subject}
              onChange={val => {setSubject(val); setSection("");}}
              placeholder="All Subjects"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1.5 font-semibold">SECTION</label>
          <div className="w-40 relative z-20">
            <FluidDropdown
              options={[
                { id: "", label: "All Sec", icon: Layers },
                ...uniqueSections.map(s => ({ id: s, label: s, icon: Layers, color: "#38bdf8" }))
              ]}
              value={section}
              onChange={setSection}
              disabled={!subject}
              placeholder="All Sec"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1.5 font-semibold">STATUS</label>
          <div className="w-44 relative z-10">
            <FluidDropdown
              options={[
                { id: "", label: "All Statuses", icon: SlidersHorizontal },
                { id: "present", label: "Present Only", icon: Check, color: "#34d399" },
                { id: "absent", label: "Absent Only", icon: X, color: "#f87171" }
              ]}
              value={status}
              onChange={setStatus}
              placeholder="All Statuses"
            />
          </div>
        </div>
        <div className="flex-1 flex justify-end">
           <button onClick={() => { setDateFrom(getThirtyDaysAgo()); setDateTo(getToday()); setSubject(""); setSection(""); setStatus(""); setMethod(""); }} className="text-xs text-slate-400 hover:text-white flex items-center gap-1 mt-6"><RefreshCw size={20} /> Reset</button>
        </div>
      </div>

      {/* Top Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 no-print">
        <div className="glass-card p-4 border border-indigo-500/20 bg-indigo-500/5">
          <p className="text-[10px] uppercase font-bold text-indigo-300">Total Classes</p>
          <div className="text-2xl font-bold text-indigo-400">{summaries.totalClasses}</div>
        </div>
        <div className="glass-card p-4 border border-emerald-500/20 bg-emerald-500/5">
          <p className="text-[10px] uppercase font-bold text-emerald-300">Total Presents</p>
          <div className="text-2xl font-bold text-emerald-400">{summaries.totalP}</div>
        </div>
        <div className="glass-card p-4 border border-red-500/20 bg-red-500/5">
          <p className="text-[10px] uppercase font-bold text-red-300">Total Absents</p>
          <div className="text-2xl font-bold text-red-400">{summaries.totalA}</div>
        </div>
        <div className="glass-card p-4">
          <p className="text-[10px] uppercase text-slate-500">Filtered Average</p>
          <div className="text-2xl font-bold text-slate-200">{summaries.overallPercent}%</div>
        </div>
        <div className="glass-card p-4">
          <p className="text-[10px] uppercase text-slate-500">Best Attendance</p>
          <div className="text-sm font-semibold truncate" title={summaries.bestAttending}>{summaries.bestAttending}</div>
        </div>
        <div className="glass-card p-4 border-l-2 border-l-red-500/40">
          <p className="text-[10px] uppercase text-red-400">Most Absent</p>
          <div className="text-sm font-semibold truncate" title={summaries.mostAbsent}>{summaries.mostAbsent}</div>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="glass-card overflow-hidden">
        <div className="flex items-center gap-1 p-2 border-b border-white/[0.06] bg-slate-900/30 no-print">
          <button onClick={() => setActiveTab("report")} className={`px-5 py-2 text-sm font-semibold rounded-lg ${activeTab==="report"?"bg-white/10 text-white":"text-slate-400 hover:bg-white/5"}`}>Report Table</button>
          <button onClick={() => setActiveTab("summary")} className={`px-5 py-2 text-sm font-semibold rounded-lg ${activeTab==="summary"?"bg-white/10 text-white":"text-slate-400 hover:bg-white/5"}`}>Student Summary</button>
          <button onClick={() => setActiveTab("defaulters")} className={`px-5 py-2 text-sm font-semibold rounded-lg flex items-center gap-2 ${activeTab==="defaulters"?"bg-red-500/20 text-red-300 border border-red-500/20":"text-slate-400 hover:bg-red-500/10"}`}><AlertCircle/> Defaulters</button>
        </div>

        {activeTab === "report" && (
          <table className="w-full text-left text-sm text-slate-400">
            <thead className="text-xs uppercase bg-slate-800/50 text-slate-300">
              <tr><th className="px-6 py-4">Name</th><th className="px-4 py-4">Subj/Sec</th><th className="px-4 py-4">Date & Time</th><th className="px-4 py-4">Method</th><th className="px-6 py-4 text-right">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {tableSlice.map(r => (
                <tr key={r.id} className={`${r.status === "absent" ? "bg-red-500/5" : ""}`}>
                  <td className="px-6 py-3 text-slate-200">
                     <span className="font-medium">{r.studentName}</span>
                     <span className="block text-xs text-slate-500">{r.rollNumber || "ID Unknown"}</span>
                  </td>
                  <td className="px-4 py-3"><span className="text-indigo-300 font-medium">{r.subject}</span> <span className="text-[10px] font-bold uppercase text-slate-500 block">{r.section}</span></td>
                  <td className="px-4 py-3"><span className="text-slate-300">{formatSafeDate(r.date)}</span> <span className="block text-xs text-slate-500">{formatSafeTime(r.timestamp)}</span></td>
                  <td className="px-4 py-3"><span className="text-xs font-semibold flex items-center gap-1.5">{r.method==="QR"?<QrCode size={20} className="text-indigo-400"/>:r.method==="Manual"?<Pencil size={20} className="text-amber-400"/>:<AlertCircle size={20} className="text-red-400"/>}{r.method}</span></td>
                  <td className="px-6 py-3 text-right">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${r.status === "present" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
              {tableSlice.length === 0 && <tr><td colSpan="5" className="p-8 text-center text-slate-500">No records found.</td></tr>}
            </tbody>
          </table>
        )}

        {activeTab === "summary" && (
          <table className="w-full text-left text-sm text-slate-400">
            <thead className="text-xs uppercase bg-slate-800/50 text-slate-300">
              <tr><th className="px-6 py-4">Name</th><th className="px-4 py-4 text-center">Held</th><th className="px-4 py-4 text-center">Attended</th><th className="px-4 py-4 text-center">Missed</th><th className="px-6 py-4 text-right">Overall %</th></tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {tableSlice.map(s => {
                const b = s.percentage>=75?"text-emerald-400 bg-emerald-500/10":s.percentage>=65?"text-amber-400 bg-amber-500/10":"text-red-400 bg-red-500/15 font-bold border border-red-500/20 shadow-sm";
                const isHighAbsence = s.missed > 10;
                return (
                  <tr key={s.studentId} className={isHighAbsence ? "bg-red-950/60 transition-colors hover:bg-red-900/60" : "hover:bg-white/[0.02] transition-colors"}>
                    <td className="px-6 py-3"><span className="font-medium text-slate-200 block">{s.name}</span><span className="text-[10px] text-indigo-400/80 font-bold uppercase">{s.section} · {s.rollNumber||"-"}</span></td>
                    <td className="px-4 py-3 text-center">{s.totalHeld}</td>
                    <td className="px-4 py-3 text-center text-emerald-400">{s.attended}</td>
                    <td className="px-4 py-3 text-center text-red-400">{s.missed}</td>
                    <td className="px-6 py-3 text-right"><span className={`px-2 py-1 rounded text-xs ${b}`}>{s.percentage.toFixed(1)}%</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {activeTab === "defaulters" && (
          <table className="w-full text-left text-sm text-slate-400">
            <thead className="text-xs uppercase bg-red-950/40 text-red-200">
              <tr><th className="px-6 py-4">Name</th><th className="px-6 py-4">Current %</th><th className="px-6 py-4">Classes Needed</th><th className="px-6 py-4 text-right">Action Tracker</th></tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {tableSlice.map(s => (
                <tr key={s.studentId} className="bg-red-500/[0.02]">
                  <td className="px-6 py-4"><span className="text-red-100 font-medium block">{s.name}</span><span className="text-[10px] text-red-400/80 font-bold uppercase">{s.section}</span></td>
                  <td className="px-6 py-4 text-lg font-bold text-red-400">{s.percentage.toFixed(1)}%</td>
                  <td className="px-6 py-4 text-slate-300 font-medium">{Math.max(0, Math.ceil((3 * s.totalHeld) - (4 * s.attended)))} consecutive</td>
                  <td className="px-6 py-4 text-right"><span className="text-xs bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2.5 py-1 rounded font-bold uppercase tracking-wider cursor-pointer hover:bg-amber-500/20 transition-colors">Notify</span></td>
                </tr>
              ))}
              {tableSlice.length === 0 && <tr><td colSpan="4" className="p-12 text-center text-emerald-500 bg-emerald-500/5 font-semibold">Great news! No defaulters found.</td></tr>}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-white/[0.06] flex items-center justify-between no-print text-sm">
            <span>Showing {(currentPage-1)*rowsPerPage+1}-{Math.min(currentPage*rowsPerPage, currentArray.length)} of {currentArray.length}</span>
            <div className="flex gap-2">
              <button disabled={currentPage<=1} onClick={()=>setCurrentPage(p=>p-1)} className="btn-secondary py-1 px-3">Prev</button>
              <button disabled={currentPage>=totalPages} onClick={()=>setCurrentPage(p=>p+1)} className="btn-secondary py-1 px-3">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
