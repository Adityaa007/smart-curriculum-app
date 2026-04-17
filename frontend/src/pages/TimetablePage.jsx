import React, { useState, useEffect } from "react";
import {
  collection, addDoc, deleteDoc, doc,
  onSnapshot, query, serverTimestamp, where
} from "firebase/firestore";
import { db } from "../firebase";
import { isIndexError } from "../lib/firestoreUtils";
import { useAuth } from "../contexts/AuthContext";
import { Plus, Trash, Calendar, Clock, BookOpen, Check } from "lucide-react";
import { FluidDropdown } from "../components/ui/FluidDropdown";
import { BackButton } from "../components/ui/back-button";
import { formatSafeTime, formatSafeDate, formatHM } from "../lib/dateUtils";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// ── Global formatHM used instead of local formatTime ─────────────────────────────────────────

const DAY_SHORT = { Monday:"Mon", Tuesday:"Tue", Wednesday:"Wed", Thursday:"Thu", Friday:"Fri", Saturday:"Sat" };

export default function TimetablePage() {
  const { currentUser, userProfile } = useAuth();

  const [entries, setEntries]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving,  setSaving]    = useState(false);
  const [error,   setError]     = useState("");
  const [deleteId, setDeleteId] = useState(null);

  const [form, setForm] = useState({
    subject: "", day: "Monday", startTime: "", endTime: "", room: "", section: "",
  });

  const todayStr = new Date().toLocaleDateString("en-IN");
  const todayName = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [indexBuilding, setIndexBuilding] = useState(false);

  // ── Live Firestore listener ──────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser) return;
    
    // Fetch timetable
    const qTT = query(collection(db, "timetable"), where("teacherUid", "==", currentUser.uid));
    const unsubTT = onSnapshot(qTT, (snap) => {
      setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
      setIndexBuilding(false);
    }, (err) => {
      console.error("Timetable Snapshot Error:", err);
      if (isIndexError(err)) setIndexBuilding(true);
      setLoading(false);
    });

    // Fetch today's attendance to show status on timetable
    const qAtt = query(collection(db, "attendance"), where("teacherId", "==", currentUser.uid), where("date", "==", todayStr));
    const unsubAtt = onSnapshot(qAtt, (snap) => {
      setTodayAttendance(snap.docs.map(d => d.data()));
      setIndexBuilding(false);
    }, (err) => {
      console.error("Attendance Snapshot Error:", err);
      if (isIndexError(err)) setIndexBuilding(true);
    });

    return () => { unsubTT(); unsubAtt(); };
  }, [currentUser, todayStr]);

  async function handleSeed() {
    setSaving(true);
    const seedData = [
      { subject: "Data Structures", day: "Monday", startTime: "09:00", endTime: "10:30", room: "Lab 1", section: "CS-A" },
      { subject: "Web Development", day: "Tuesday", startTime: "11:00", endTime: "12:30", room: "Room 101", section: "CS-B" },
      { subject: "Database Systems", day: "Wednesday", startTime: "14:00", endTime: "15:30", room: "Room 202", section: "CS-A" }
    ];
    try {
      await Promise.all(seedData.map(data => addDoc(collection(db, "timetable"), {
        ...data,
        teacherUid: currentUser.uid,
        teacherName: userProfile?.name || "Teacher",
        createdAt: serverTimestamp(),
      })));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleAdd(e) {
    e.preventDefault();
    setError("");
    if (!form.subject.trim())   return setError("Subject name is required.");
    if (!form.section.trim())   return setError("Section is required so students can filter their schedule.");
    if (!form.startTime)        return setError("Start time is required.");
    if (!form.endTime)          return setError("End time is required.");
    if (form.startTime >= form.endTime) return setError("End time must be after start time.");

    setSaving(true);
    try {
      await addDoc(collection(db, "timetable"), {
        subject:     form.subject.trim(),
        day:         form.day,
        startTime:   form.startTime,
        endTime:     form.endTime,
        room:        form.room.trim(),
        section:     form.section.trim().toUpperCase(),
        teacherUid:  currentUser.uid,
        teacherName: userProfile?.name || "Teacher",
        createdAt:   serverTimestamp(),
      });
      setForm((prev) => ({ ...prev, subject: "", startTime: "", endTime: "", room: "" }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    setDeleteId(id);
    try {
      await deleteDoc(doc(db, "timetable", id));
    } catch (err) {
      console.error(err);
    } finally {
      setDeleteId(null);
    }
  }

  // Group by day (only days with entries)
  const byDay = DAYS.reduce((acc, day) => {
    acc[day] = entries
      .filter((e) => e.day === day)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    return acc;
  }, {});

  const activeDays = DAYS.filter((d) => byDay[d].length > 0);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* ── Header ── */}
      <div className="mb-7 flex items-start justify-between">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Timetable Manager</h1>
            <p className="text-slate-400 text-sm mt-1">Build the weekly class schedule — students see it instantly</p>
          </div>
        </div>
        <button onClick={handleSeed} disabled={saving} className="btn-primary flex items-center gap-2" style={{ padding: "0.5rem 1rem", width: "auto" }}>
          Seed Samples
        </button>
      </div>

      {/* ── Add Entry Form ── */}
      <div className="relative glass-card p-6 mb-10 border border-indigo-500/20 overflow-visible z-20" style={{ background: "linear-gradient(135deg, rgba(99, 102, 241, 0.05), transparent)" }}>
        <p className="text-sm font-bold text-indigo-400 uppercase tracking-widest mb-5 flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-indigo-500/20 flex items-center justify-center"><Plus size={14} /></span> Add Class Entry
        </p>

        {error && (
          <div className="mb-4 px-4 py-2.5 rounded-xl text-sm text-red-300 bg-red-500/10 border border-red-500/20">
            {error}
          </div>
        )}

        <form onSubmit={handleAdd}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            {/* Subject */}
            <div className="col-span-2 md:col-span-1">
              <label className="block text-xs text-slate-400 mb-1.5">Subject *</label>
              <input
                id="tt-subject" name="subject" type="text"
                value={form.subject} onChange={handleChange}
                placeholder="e.g. Data Structures"
                className="input-dark"
              />
            </div>

            {/* Section */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Section *</label>
              <input
                id="tt-section" name="section" type="text"
                value={form.section} onChange={handleChange}
                placeholder="e.g. CS-A"
                className="input-dark"
              />
            </div>

            {/* Room */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Room</label>
              <input
                id="tt-room" name="room" type="text"
                value={form.room} onChange={handleChange}
                placeholder="e.g. Lab 3"
                className="input-dark"
              />
            </div>

            {/* Day */}
            <div className="relative z-20">
              <label className="block text-xs text-slate-400 mb-1.5">Day *</label>
              <FluidDropdown
                options={DAYS.map((d) => ({ id: d, label: d, icon: Calendar, color: "#f472b6" }))}
                value={form.day}
                onChange={(val) => handleChange({ target: { name: "day", value: val } })}
                placeholder="Select Day"
              />
            </div>

            {/* Start Time */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Start Time *</label>
              <input
                id="tt-start" name="startTime" type="time"
                value={form.startTime} onChange={handleChange}
                className="input-dark"
              />
            </div>

            {/* End Time */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">End Time *</label>
              <input
                id="tt-end" name="endTime" type="time"
                value={form.endTime} onChange={handleChange}
                className="input-dark"
              />
            </div>
          </div>

          <button
            id="tt-submit" type="submit" disabled={saving}
            className="btn-primary"
            style={{ width: "auto", padding: "0.65rem 2rem" }}
          >
            {saving ? "Adding…" : "Add to Schedule"}
          </button>
        </form>
      </div>

      {/* ── Weekly View ── */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
          Weekly Schedule
        </p>
        <span className="badge bg-indigo-500/15 text-indigo-400 border border-indigo-500/25 text-xs">
          {entries.length} {entries.length === 1 ? "class" : "classes"} total
        </span>
      </div>

      {indexBuilding ? (
        <div className="glass-card py-16 flex flex-col items-center justify-center text-center gap-4 animate-fade-in shadow-xl bg-slate-800/20">
          <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
          <div>
            <h2 className="text-lg font-bold text-slate-100">Preparing schedule...</h2>
            <p className="text-slate-400 text-xs mt-1 max-w-sm">
              We're setting up the necessary connections to fetch your timetable. Please wait a moment.
            </p>
          </div>
        </div>
      ) : loading ? (
        <div className="glass-card py-12 text-center text-slate-500">Loading…</div>
      ) : activeDays.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Calendar size={38} className="text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400">No classes yet. Use the form above to build the schedule.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeDays.map((day) => (
            <div key={day} className="glass-card overflow-hidden">
              {/* Day header */}
              <div className="px-4 py-2.5 border-b border-white/[0.05] flex items-center gap-3">
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider w-20">{day}</span>
                <span className="text-xs text-slate-600">
                  {byDay[day].length} class{byDay[day].length > 1 ? "es" : ""}
                </span>
              </div>

              {/* Entries */}
              <div className="divide-y divide-white/[0.04]">
                {byDay[day].map((entry) => {
                  const isToday = day === todayName;
                  const isMarked = isToday && todayAttendance.some(a => a.subject === entry.subject && a.section === entry.section);
                  const isPending = isToday && !isMarked;
                  
                  return (
                    <div
                      key={entry.id}
                      className={`flex items-center justify-between px-4 py-3 hover:bg-white/[0.06] transition-colors group ${isPending ? "bg-orange-500/[0.04]" : ""}`}
                    >
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        {/* Time */}
                        <div className="shrink-0 text-xs font-medium text-slate-400 w-28">
                          <Clock size={12} className="inline mr-1 mb-0.5 opacity-70" />
                          {formatHM(entry.startTime)} – {formatHM(entry.endTime)}
                        </div>
                        {/* Subject + meta */}
                        <div className="min-w-0 flex-1 flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-200 truncate pr-2">{entry.subject}</p>
                            <p className="text-[11px] font-semibold text-slate-500 truncate">
                              {[entry.room && `📍 ${entry.room}`, `§ ${entry.section}`].filter(Boolean).join("  ·  ")}
                            </p>
                          </div>
                          {/* Inline Status Badge (Only for Today's Classes) */}
                          {isToday && (
                             <div className="shrink-0 mt-1 md:mt-0">
                               {isMarked ? (
                                 <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                                   <Check size={12} /> Attendance Taken
                                 </span>
                               ) : (
                                 <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-orange-500/10 text-orange-400 border border-orange-500/20 whitespace-nowrap">
                                   ⚠️ Pending
                                 </span>
                               )}
                             </div>
                          )}
                        </div>
                      </div>

                      {/* Delete */}
                      <button
                        onClick={() => handleDelete(entry.id)}
                        disabled={deleteId === entry.id}
                        className="ml-3 p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete entry"
                      >
                        <Trash size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
