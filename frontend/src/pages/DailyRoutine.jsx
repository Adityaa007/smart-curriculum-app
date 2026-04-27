import useTitle from "../hooks/useTitle";
import React, { useState, useEffect, useRef } from "react";
import { collection, query, orderBy, onSnapshot, doc, getDoc, setDoc, serverTimestamp, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { safeGetDocs, isIndexError } from "../lib/firestoreUtils";
import { useAuth } from "../contexts/AuthContext";
import { Sparkles, Calendar, CheckCircle, XCircle, Pencil, Trash, Plus, Zap, BarChart, Check, Play } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import API_BASE from "../lib/api";




// ── getLocalDateStr ─────────────────────────────────────────────────────────
// Returns a YYYY-MM-DD string in the device's LOCAL timezone.
// NEVER use new Date().toISOString().split("T")[0] — that returns UTC, which
// is wrong for IST (UTC+5:30) users after midnight local time.
// Usage: getLocalDateStr()        → today in local timezone
//        getLocalDateStr(someDate) → any Date in local timezone
function getLocalDateStr(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// â”€â”€ Constants & Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const CATEGORIES = {
  Class: { color: "purple", icon: "ðŸ«" },
  Study: { color: "blue", icon: "ðŸ“š" },
  Break: { color: "green", icon: "â˜•" },
  Meal: { color: "orange", icon: "ðŸ±" },
  Exercise: { color: "red", icon: "ðŸƒ" },
  Personal: { color: "teal", icon: "ðŸŽ¨" },
  Sleep: { color: "slate", icon: "ðŸŒ™" }
};

const getCategoryStyles = (cat) => {
  const c = CATEGORIES[cat] || CATEGORIES.Personal;
  return {
    border: `border-${c.color}-500/30`,
    bg: `bg-${c.color}-500/10`,
    text: `text-${c.color}-400`,
    indicator: `bg-${c.color}-500`,
  };
};

function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  // Support both "H:MM AM/PM" and "HH:MM"
  let h, m, period;
  if (timeStr.includes(' ')) {
    const [time, p] = timeStr.split(' ');
    [h, m] = time.split(':').map(Number);
    period = p;
  } else {
    [h, m] = timeStr.split(':').map(Number);
  }

  if (period === "PM" && h < 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return h * 60 + (m || 0);
}

// â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function DailyRoutine() {
  useTitle("Daily Routine");
  const { currentUser, userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [routine, setRoutine] = useState([]);
  const [editingIndex, setEditingIndex] = useState(-1);
  const [streak, setStreak] = useState(0);
  const [weeklyProgress, setWeeklyProgress] = useState([]);
  const [quote, setQuote] = useState("");
  const [activeFocusIndex, setActiveFocusIndex] = useState(-1);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [indexBuilding, setIndexBuilding] = useState(false);
  const [indexError, setIndexError] = useState(null);
  const [liveNow, setLiveNow] = useState(new Date());

  useEffect(() => {
    if (activeFocusIndex !== -1) {
      setLiveNow(new Date());
      const tick = setInterval(() => setLiveNow(new Date()), 1000);
      return () => clearInterval(tick);
    }
  }, [activeFocusIndex]);

  const timelineRefs = useRef([]);
  // Use local-timezone date — toISOString() is UTC and breaks in IST
  const todayStr = getLocalDateStr();
  const todayName = new Date().toLocaleDateString("en-US", { weekday: "long" });

  // 1. Motivational Quote
  useEffect(() => {
    const quotes = [
      "The secret of your future is hidden in your daily routine.",
      "Success is the sum of small efforts, repeated day in and day out.",
      "Don't decrease the goal. Increase the effort.",
      "Your habits determine your future.",
      "Focus on being productive instead of busy."
    ];
    const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
    setQuote(quotes[dayOfYear % quotes.length]);
  }, []);

  // 2. Fetch Data (Routine + Streak)
  useEffect(() => {
    // Hard UID guard — never attempt Firestore ops without a confirmed uid
    if (!currentUser?.uid) return;
    const uid = currentUser.uid;

    // Load Today's Routine — ID MUST match rule: `{uid}_{YYYY-MM-DD}`
    const routineId = `${uid}_${todayStr}`;
    console.log("[Routine] UID:", uid);
    console.log("[Routine] Reading routineId:", routineId);

    const routineRef = doc(db, "routines", routineId);
    const unsubRoutine = onSnapshot(routineRef, (docSnap) => {
      if (docSnap.exists()) {
        setRoutine(docSnap.data().routine || []);
      } else {
        setRoutine([]);
      }
      setLoading(false);
      setIndexBuilding(false);
    }, (error) => {
      console.error("[Routine] Snapshot error:", error.code, error.message);
      if (isIndexError(error)) {
        setIndexBuilding(true);
      } else {
        setIndexError(error.message);
      }
      setLoading(false);
    });

    // Stats: fetch last 30 days by direct doc IDs — no collection scan needed.
    // The security rule matches on document ID ({uid}_date), so point-reads
    // of `${uid}_${date}` always pass without requiring a Firestore index.
    const fetchStats = async () => {
      try {
        const LOOKBACK = 30;
        const fetchPromises = [];
        for (let i = 0; i < LOOKBACK; i++) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const ds = getLocalDateStr(d);
          const docId = `${uid}_${ds}`;
          fetchPromises.push(
            getDoc(doc(db, "routines", docId)).then(snap =>
              snap.exists() ? { ...snap.data(), _date: ds } : null
            )
          );
        }
        const results = await Promise.allSettled(fetchPromises);
        const allRoutines = results
          .filter(r => r.status === 'fulfilled' && r.value !== null)
          .map(r => r.value);

        const last7 = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(); d.setDate(d.getDate() - i);
          const ds = getLocalDateStr(d);
          const found = allRoutines.find(r => (r.date || r._date) === ds);
          last7.push({ date: ds, progress: found ? (found.completionPercentage || 0) : 0, isToday: i === 0 });
        }
        setWeeklyProgress(last7);

        let currentStreak = 0;
        let checkDate = new Date();
        const todayRoutine = allRoutines.find(r => (r.date || r._date) === todayStr);
        if (!todayRoutine || (todayRoutine.completionPercentage || 0) < 50) {
          checkDate.setDate(checkDate.getDate() - 1);
        }
        for (let i = 0; i < LOOKBACK; i++) {
          const ds = getLocalDateStr(checkDate);
          const r = allRoutines.find(rout => (rout.date || rout._date) === ds);
          if (r && (r.completionPercentage || 0) >= 50) {
            currentStreak++; checkDate.setDate(checkDate.getDate() - 1);
          } else { break; }
        }
        setStreak(currentStreak);
        setIndexBuilding(false);
      } catch (error) {
        console.error("[Routine] Stats fetch error:", error.code, error.message);
        if (isIndexError(error)) { setIndexBuilding(true); }
        else { setIndexError(error.message); }
      }
    };

    fetchStats();
    return () => unsubRoutine();
  }, [currentUser, todayStr]);

  // 3. Generate Routine
  async function generateFullRoutine() {
    if (generating || !userProfile) return;
    setGenerating(true);

    try {
      const q = query(collection(db, "timetable"), where("day", "==", todayName));
      const tSnap = await getDocs(q);
      const timetable = tSnap.docs.map(d => d.data())
        .filter(c => !userProfile.section || c.section?.toUpperCase() === userProfile.section?.toUpperCase());

      const payload = {
        type: "full",
        interests: userProfile.interests,
        strengths: userProfile.strengths,
        careerGoal: userProfile.careerGoal,
        studyPreference: userProfile.studyPreference,
        dailyFreeTime: userProfile.dailyFreeTime,
        timetable
      };

      const res = await fetch(`${API_BASE}/api/generate-routine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      const initialized = data.map(t => ({ ...t, status: 'pending' }));
      await saveRoutine(initialized);
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  }

  async function regenerateSlot(index) {
    const slot = routine[index];
    try {
      const res = await fetch(`${API_BASE}/api/generate-routine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "single",
          slot,
          interests: userProfile.interests,
          careerGoal: userProfile.careerGoal
        })
      });
      const newSlot = await res.json();
      const newRoutine = [...routine];
      newRoutine[index] = { ...newSlot, status: 'pending' };
      await saveRoutine(newRoutine);
    } catch (err) {
      console.error(err);
    }
  }

  // 4. Persistence
  async function saveRoutine(newRoutine) {
    // Hard guard — never write to Firestore without a confirmed uid
    if (!currentUser?.uid) {
      console.error("[Routine] saveRoutine called without authenticated user — aborting.");
      return;
    }
    const uid = currentUser.uid;
    const routineId = `${uid}_${todayStr}`;
    console.log("[Routine] UID:", uid);
    console.log("[Routine] Writing routineId:", routineId);

    const completed = newRoutine.filter(t => t.status === "completed").length;
    const total = newRoutine.length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    // setDoc with explicit ID — MUST match Firestore rule: `{uid}_{YYYY-MM-DD}`
    await setDoc(doc(db, "routines", routineId), {
      studentId: uid,
      date: todayStr,
      routine: newRoutine,
      completionPercentage: percent,
      savedAt: serverTimestamp(),
    });
  }

  // 5. Actions
  const updateStatus = async (index, status) => {
    const newRoutine = [...routine];
    newRoutine[index].status = status;
    await saveRoutine(newRoutine);
  };

  const deleteItem = async (index) => {
    const newRoutine = routine.filter((_, i) => i !== index);
    await saveRoutine(newRoutine);
  };

  const addItem = async () => {
    const newItem = {
      time: "08:00 AM",
      endTime: "09:00 AM",
      activity: "New Task",
      description: "Click to edit details",
      category: "Personal",
      priority: "Medium",
      icon: "ðŸ“‹",
      status: "pending"
    };
    await saveRoutine([...routine, newItem]);
  };

  const handleEditChange = (index, field, value) => {
    const newRoutine = [...routine];
    newRoutine[index][field] = value;
    setRoutine(newRoutine);
  };

  const saveEdit = async () => {
    await saveRoutine(routine);
    setEditingIndex(-1);
  };

  // 6. Highlight Current
  useEffect(() => {
    const checkCurrent = () => {
      const now = new Date();
      const nowMins = now.getHours() * 60 + now.getMinutes();
      const idx = routine.findIndex(item => {
        const start = timeToMinutes(item.time);
        const end = timeToMinutes(item.endTime);
        return nowMins >= start && nowMins < end;
      });
      setCurrentIndex(idx);
    };
    checkCurrent();
    const interval = setInterval(checkCurrent, 60000);
    return () => clearInterval(interval);
  }, [routine]);

  // Auto-scroll to current
  useEffect(() => {
    if (currentIndex !== -1 && timelineRefs.current[currentIndex]) {
      timelineRefs.current[currentIndex].scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [currentIndex]);

  const completionCount = routine.filter(t => t.status === 'completed').length;
  const completionPercent = routine.length > 0 ? Math.round((completionCount / routine.length) * 100) : 0;

  if (loading) return <div className="p-10 text-center text-slate-500 animate-pulse">Initializing your day...</div>;

  if (indexBuilding) {
    return (
      <div className="p-10 flex flex-col items-center justify-center min-h-[400px] text-center gap-4 animate-fade-in">
        <div className="w-16 h-16 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
        <div>
          <h2 className="text-xl font-bold text-slate-100">Preparing data...</h2>
          <p className="text-slate-400 text-sm mt-1 max-w-sm">
            We're setting up the necessary connections to fetch your routine. Please wait a moment.
          </p>
        </div>
      </div>
    );
  }

  if (indexError) {
    return (
      <div className="p-10 flex flex-col items-center justify-center min-h-[400px] text-center gap-4 animate-fade-in">
        <div className="w-16 h-16 bg-red-500/10 text-red-400 rounded-2xl flex items-center justify-center border border-red-500/20">
          <Zap size={32} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-100">Connection Issue</h2>
          <p className="text-slate-400 text-sm mt-1 max-w-sm">{indexError}</p>
          <button onClick={() => window.location.reload()} className="btn-primary mt-6" style={{ width: "auto", padding: "0.6rem 2rem" }}>
            Retry Now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 pb-32">
      {/* â”€â”€ Header â”€â”€ */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-violet-500/10 text-violet-400 rounded-xl border border-violet-500/20">
              <Calendar size={24} />
            </span>
            <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">
              {todayName}, {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" })}
            </h1>
          </div>
          <p className="text-slate-400 text-lg font-medium italic opacity-80">"{quote}"</p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* ðŸ“Š Unified Stats Panel */}
          <div className="glass-card p-5 flex items-center justify-between gap-6 border-slate-700/50 bg-slate-800/20 w-full md:w-auto shadow-xl">
            <div className="flex items-center gap-4 border-r border-white/10 pr-6">
              <span className="text-4xl filter drop-shadow-[0_0_15px_rgba(245,158,11,0.4)]">ðŸ”¥</span>
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-0.5">Streak</p>
                <p className="text-xl font-black text-slate-100">{streak} <span className="text-sm font-bold text-slate-500">Days</span></p>
                {streak === 0 && <p className="text-[9px] text-amber-500/80 leading-tight mt-1 max-w-[100px]">Build a streak by completing tasks</p>}
              </div>
            </div>

            <div className="flex flex-col justify-center min-w-[200px]">
              <div className="flex justify-between items-end mb-2.5">
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-0.5">Today's Progress</p>
                  <p className="text-sm font-black text-slate-200">{completionCount} / {routine.length} Tasks</p>
                </div>
                <span className="text-2xl font-black text-emerald-400 filter drop-shadow-md leading-none">{completionPercent}%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-white/5">
                <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(16,185,129,0.5)]" style={{ width: `${Math.max(completionPercent, 2)}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* â”€â”€ Weekly Preview â”€â”€ */}
      <div className="flex justify-between gap-2 overflow-x-auto pb-4 scrollbar-hide">
        {weeklyProgress.map((day, i) => {
          const isToday = day.isToday;
          const colorClass = day.progress >= 80 ? 'text-emerald-400 border-emerald-500/50' : day.progress >= 50 ? 'text-amber-400 border-amber-500/50' : day.progress > 0 ? 'text-red-400 border-red-500/50' : 'text-slate-600 border-white/5';
          return (
            <div key={i} className={`flex-1 min-w-[70px] flex flex-col items-center gap-3 p-4 rounded-2xl glass-card transition-all duration-300 ${isToday ? 'bg-violet-500/10 ring-2 ring-violet-500/40 border-violet-500/40' : 'border-white/5'}`}>
              <span className={`text-xs font-black uppercase ${isToday ? 'text-violet-400' : 'text-slate-500'}`}>
                {new Date(day.date).toLocaleDateString("en-US", { weekday: "short" })}
              </span>
              <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-[10px] font-black ${colorClass}`}>
                {day.progress}%
              </div>
            </div>
          );
        })}
      </div>

      {/* â”€â”€ Main Content / Empty State â”€â”€ */}
      {routine.length === 0 && !generating ? (
        <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
          <div className="w-24 h-24 bg-violet-500/10 rounded-3xl flex items-center justify-center mb-8 border border-violet-500/20 shadow-2xl shadow-violet-500/10">
            <Sparkles size={48} className="text-violet-400 animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold text-slate-100 mb-2">Build your perfect day âœ¨</h2>
          <p className="text-slate-400 max-w-xs mb-8 leading-relaxed">Let AI transform your timetable and goals into a high-productivity routine.</p>
          <button
            onClick={generateFullRoutine}
            className="px-8 py-4 bg-violet-600 hover:bg-violet-500 text-white rounded-2xl font-black flex items-center gap-3 transition-all hover:scale-105 shadow-xl shadow-violet-600/30 active:scale-95"
          >
            <Sparkles size={20} />
            Generate My Day
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Action Bar */}
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">Timeline</h2>
            <div className="flex gap-3">
              <button
                onClick={generateFullRoutine}
                disabled={generating}
                className="flex items-center gap-2 text-xs font-bold text-violet-400 hover:text-violet-300 transition-colors disabled:opacity-50"
              >
                <Sparkles size={16} /> Regenerate
              </button>
              <button onClick={addItem} className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-slate-100 transition-colors">
                <Plus size={16} /> Add Custom
              </button>
            </div>
          </div>

          {/* Timeline Grid */}
          <div className="space-y-3 md:space-y-4 relative mt-8">
            {/* Dynamic Line */}
            <div className="absolute left-[39px] md:left-[43px] top-4 bottom-4 w-[2px] bg-gradient-to-b from-violet-500/40 via-slate-700/50 to-transparent z-0" />

            {generating && (
              <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/40 backdrop-blur-[2px] rounded-3xl animate-fade-in">
                <div className="bg-slate-900 p-8 rounded-3xl border border-white/5 flex flex-col items-center gap-4 shadow-2xl">
                  <span className="text-4xl animate-bounce">ðŸ§ </span>
                  <p className="text-violet-300 font-bold tracking-widest uppercase text-xs animate-pulse">AI is planning your perfect day...</p>
                </div>
              </div>
            )}

            {routine.map((item, idx) => {
              const isCurrent = idx === currentIndex;
              const catStyles = getCategoryStyles(item.category);
              const isEditing = editingIndex === idx;

              const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
              const startMins = timeToMinutes(item.time);
              const endMins = timeToMinutes(item.endTime);

              let timeStatusColor = "";
              let timeStatusLabel = "";

              if (item.status === 'completed' || item.status === 'skipped') {
                // Clean slate if finished
              } else {
                if (nowMins > endMins) {
                  timeStatusColor = "bg-red-500/10 border-red-500/30";
                  timeStatusLabel = "OVERDUE";
                } else if (nowMins >= startMins - 15 && nowMins <= endMins) {
                  timeStatusColor = "bg-orange-500/10 border-orange-500/30";
                  timeStatusLabel = "DUE SOON";
                } else if (startMins > nowMins) {
                  timeStatusColor = "bg-emerald-500/5 border-emerald-500/20";
                  timeStatusLabel = "ON TRACK";
                }
              }

              const opacityClass = isCurrent ? 'opacity-100' : (item.status === 'completed' || item.status === 'skipped' ? 'opacity-50' : 'opacity-85');

              return (
                <motion.div
                  key={idx}
                  ref={el => timelineRefs.current[idx] = el}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`relative flex gap-5 md:gap-8 items-start group ${opacityClass} hover:opacity-100 transition-opacity duration-300`}
                >
                  {/* Time */}
                  <div className="w-16 md:w-20 pt-1 shrink-0 text-right">
                    <span className={`text-[10px] md:text-xs font-black font-mono tracking-wider ${isCurrent ? 'text-violet-400' : 'text-slate-500'}`}>
                      {item.time}
                    </span>
                  </div>

                  {/* Dot */}
                  <div className="relative z-10 pt-1.5 shrink-0 flex justify-center w-6">
                    <motion.div
                      initial={false}
                      animate={{
                        scale: isCurrent ? [1, 1.3, 1] : 1,
                        boxShadow: isCurrent ? "0 0 20px rgba(139,92,246,0.6)" : "none"
                      }}
                      transition={{ repeat: isCurrent ? Infinity : 0, duration: 2 }}
                      className={`w-3.5 h-3.5 rounded-full ring-[3px] ring-slate-900 transition-colors duration-500 ${isCurrent ? 'bg-violet-400' : Object.keys(timeStatusColor).length && item.status !== 'completed' ? (timeStatusLabel === 'OVERDUE' ? 'bg-red-500' : timeStatusLabel === 'DUE SOON' ? 'bg-orange-500' : 'bg-emerald-500') : 'bg-slate-700'}`}
                    />
                  </div>

                  {/* Card */}
                  <motion.div
                    whileHover={{ scale: isCurrent ? 1.02 : 1.01 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className={`flex-1 glass-card p-5 md:p-6 relative overflow-hidden transition-colors duration-300 border ${isCurrent ? 'border-violet-500/40 bg-violet-500/[0.04] shadow-[0_10px_40px_rgba(139,92,246,0.15)] ring-1 ring-violet-500/20' : item.status === 'completed' ? 'border-emerald-500/10 bg-black/20' : timeStatusColor || 'border-white/[0.03] hover:border-white/10 dark-glow'}`}
                  >

                    {isCurrent && (
                      <div className="absolute top-0 right-0 px-5 py-1.5 bg-gradient-to-r from-violet-600 to-violet-500 text-[10px] font-black text-white rounded-bl-2xl uppercase tracking-widest shadow-lg">
                        Active Now
                      </div>
                    )}

                    {isEditing ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <input value={item.time} onChange={(e) => handleEditChange(idx, 'time', e.target.value)} className="input-dark text-xs py-2" placeholder="Start Time" />
                          <input value={item.endTime} onChange={(e) => handleEditChange(idx, 'endTime', e.target.value)} className="input-dark text-xs py-2" placeholder="End Time" />
                        </div>
                        <input value={item.activity} onChange={(e) => handleEditChange(idx, 'activity', e.target.value)} className="input-dark text-sm py-2.5 w-full font-bold" placeholder="Activity Title" />
                        <textarea value={item.description} onChange={(e) => handleEditChange(idx, 'description', e.target.value)} className="input-dark text-xs py-2.5 w-full resize-none" rows="2" placeholder="Brief description..." />
                        <div className="flex justify-between items-center bg-black/20 p-2 rounded-xl">
                          <select value={item.category} onChange={(e) => handleEditChange(idx, 'category', e.target.value)} className="bg-transparent text-xs text-slate-300 border-none focus:ring-0 outline-none">
                            {Object.keys(CATEGORIES).map(c => <option key={c} value={c} className="bg-slate-900">{c}</option>)}
                          </select>
                          <button onClick={saveEdit} className="bg-violet-500 hover:bg-violet-400 text-white px-5 py-2 rounded-xl text-xs font-black transition-colors">SAVE CHANGES</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-3 pr-10 md:pr-12">
                          <div className="flex items-center flex-wrap gap-2.5">
                            <span className="text-3xl filter drop-shadow-md">{item.icon}</span>
                            <h3 className={`text-xl md:text-2xl font-extrabold tracking-tight ${item.status === 'completed' ? 'line-through decoration-emerald-500/50 text-slate-500' : 'text-slate-100'}`}>
                              {item.activity}
                            </h3>

                            {timeStatusLabel && item.status !== 'completed' && item.status !== 'skipped' && !isCurrent && (
                              <span className={`ml-2 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${timeStatusLabel === 'OVERDUE' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : timeStatusLabel === 'DUE SOON' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                                {timeStatusLabel === 'DUE SOON' ? 'SOON' : timeStatusLabel}
                              </span>
                            )}

                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wider ${catStyles.bg} ${catStyles.text} border ${catStyles.border} mt-0.5 ml-1`}>
                              {item.category}
                            </span>

                            {item.priority === 'High' && (
                              <span className="text-[9px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20 mt-0.5">
                                Priority
                              </span>
                            )}
                          </div>
                          <p className={`text-sm leading-relaxed transition-colors pr-8 md:pr-12 ${item.status === 'completed' ? 'text-slate-600' : 'text-slate-400 line-clamp-2 md:line-clamp-none'}`}>
                            {item.description}
                          </p>

                          {/* Actions / Status Messaging */}
                          <div className="flex flex-wrap items-center gap-2.5 mt-5 pt-4 border-t border-white/5">
                            {item.status === 'completed' ? (
                              <motion.span
                                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                                className="text-emerald-400 text-xs font-bold flex items-center gap-1.5 py-1 bg-emerald-500/10 px-3 rounded-lg border border-emerald-500/20"
                              >
                                <CheckCircle size={18} /> Awesome! You conquered this task.
                              </motion.span>
                            ) : item.status === 'skipped' ? (
                              <span className="text-slate-500 text-xs font-bold flex items-center gap-1.5 py-1 px-3 bg-black/40 rounded-lg">
                                <XCircle size={18} /> Task Skipped
                              </span>
                            ) : (
                              <>
                                <motion.button
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => updateStatus(idx, 'completed')}
                                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20 rounded-xl text-xs font-black transition-colors flex items-center gap-1.5"
                                >
                                  <CheckCircle size={18} strokeWidth={2.5} /> Mark Done
                                </motion.button>
                                <motion.button
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => setActiveFocusIndex(idx)}
                                  className="px-5 py-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                                >
                                  <Play size={18} /> Start Focus
                                </motion.button>
                                <motion.button
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => updateStatus(idx, 'skipped')}
                                  className="px-3 py-2.5 hover:bg-white/5 text-slate-500 hover:text-red-400 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ml-auto md:ml-0"
                                >
                                  <XCircle size={18} /> Skip
                                </motion.button>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 absolute top-4 right-4">
                          {/* Options Overlay (Group Hover) */}
                          <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 bg-slate-900/60 md:bg-transparent rounded-xl px-1">
                            <motion.button whileHover={{ y: -2 }} onClick={() => setEditingIndex(idx)} className="p-2 text-slate-500 hover:text-violet-400 transition-colors bg-white/[0.03] rounded-xl hover:bg-white-[0.05]" title="Edit"><Pencil size={16} /></motion.button>
                            <motion.button whileHover={{ y: -2 }} onClick={() => regenerateSlot(idx)} className="p-2 text-slate-500 hover:text-amber-400 transition-colors bg-white/[0.03] rounded-xl hover:bg-white-[0.05]" title="AI Swap"><Sparkles size={16} /></motion.button>
                            <motion.button whileHover={{ y: -2 }} onClick={() => deleteItem(idx)} className="p-2 text-slate-500 hover:text-red-500 transition-colors bg-white/[0.03] rounded-xl hover:bg-red-500/10" title="Delete"><Trash size={16} /></motion.button>
                          </div>
                        </div>
                      </>
                    )}
                  </motion.div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Completion Celebration Overlay */}
      {completionPercent === 100 && routine.length > 0 && (
        <div className="fixed inset-0 bg-emerald-500/10 backdrop-blur-md flex items-center justify-center z-[100] animate-fade-in">
          <div className="glass-card p-12 flex flex-col items-center gap-6 text-center transform scale-110 border-emerald-500/30">
            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center animate-bounce">
              <Check size={48} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-4xl font-black text-white mb-2 tracking-tight">DAY COMPLETE! ðŸ¥³</h2>
              <p className="text-emerald-200/60 font-medium">You followed your routine perfectly today.</p>
            </div>
            <div className="px-8 py-3 bg-emerald-600 text-white rounded-2xl font-black shadow-xl shadow-emerald-600/30">
              100% PRODUCTIVITY
            </div>
            <button
              onClick={() => { }} // Close or share logic
              className="text-slate-500 text-sm font-bold hover:text-white transition-colors"
              style={{ pointerEvents: 'auto' }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Focus Mode Overlay */}
      <AnimatePresence>
        {activeFocusIndex !== -1 && routine[activeFocusIndex] && (() => {
          const currentItem = routine[activeFocusIndex];
          const nextItem = activeFocusIndex < routine.length - 1 ? routine[activeFocusIndex + 1] : null;

          // Calculate Progress & Time Remaining
          const startMins = timeToMinutes(currentItem.time);
          const endMins = timeToMinutes(currentItem.endTime);
          const nowMins = liveNow.getHours() * 60 + liveNow.getMinutes();

          const totalMins = endMins - startMins;
          const elapsedMins = nowMins - startMins;

          // State Logic
          const isCompleted = currentItem.status === 'completed';
          const isUpcoming = !isCompleted && nowMins < startMins;
          const isOverdue = !isCompleted && nowMins >= endMins;
          const isActive = !isCompleted && nowMins >= startMins && nowMins < endMins;

          let pct = totalMins > 0 ? (elapsedMins / totalMins) * 100 : 0;
          if (pct < 0) pct = 0;
          if (pct > 100) pct = 100;

          let countStr = "";
          let timerColor = "text-indigo-400";
          let headerLabel = "";
          let headerColorClass = "text-indigo-400";
          let dotColorClass = "bg-indigo-500";
          let isButtonDisabled = false;

          if (isCompleted) {
            pct = 100;
            countStr = "Task Finished";
            timerColor = "text-emerald-500";
            headerLabel = "TASK COMPLETED";
            headerColorClass = "text-emerald-500";
            dotColorClass = "bg-emerald-500 opacity-0"; // hidden
            isButtonDisabled = true;
          } else if (isUpcoming) {
            pct = 0;
            const diff = startMins - nowMins;
            const h = Math.floor(diff / 60);
            const m = diff % 60;
            countStr = h > 0 ? `Starts in ${h}h ${m}m` : `Starts in ${m} mins`;
            timerColor = "text-slate-400";
            headerLabel = "UPCOMING BLOCK";
            headerColorClass = "text-slate-500";
            dotColorClass = "bg-slate-500 opacity-0"; // hidden
            isButtonDisabled = true;
          } else if (isOverdue) {
            pct = 100;
            countStr = "Time is up!";
            timerColor = "text-red-400";
            headerLabel = "OVERDUE";
            headerColorClass = "text-red-500";
            dotColorClass = "bg-red-500 animate-pulse";
            isButtonDisabled = false;
          } else {
            // Active
            const minsLeft = endMins - nowMins - 1;
            const secsLeft = 59 - liveNow.getSeconds();
            countStr = `${minsLeft}m ${secsLeft < 10 ? '0' : ''}${secsLeft}s remaining`;
            if (minsLeft < 5) timerColor = "text-amber-400";
            headerLabel = "FOCUS MODE ACTIVE";
            headerColorClass = "text-indigo-400";
            dotColorClass = "bg-indigo-500 animate-pulse";
            isButtonDisabled = false;
          }

          const getRingColor = () => {
            if (isCompleted) return 'text-emerald-500';
            if (isUpcoming) return 'text-slate-700';
            if (isOverdue) return 'text-red-500';
            return pct > 85 ? 'text-amber-500' : 'text-indigo-500';
          };

          const circleCircumference = 2 * Math.PI * 46; // r=46
          const strokeDashoffset = circleCircumference - (pct / 100) * circleCircumference;

          return (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6"
            >
              <div className="w-full max-w-lg glass-card p-8 md:p-12 flex flex-col items-center text-center shadow-[0_0_50px_rgba(99,102,241,0.2)] border-indigo-500/30">

                {/* Floating Icon with SVG Progress Ring */}
                <div className="relative mb-6">
                  <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 100 100">
                    {/* Background Ring */}
                    <circle cx="50" cy="50" r="46" fill="transparent" stroke="currentColor" strokeWidth="3" className="text-white/5" strokeDasharray={isUpcoming ? "6 6" : "none"} />
                    {/* Progress Ring */}
                    {!isUpcoming && (
                      <motion.circle
                        cx="50" cy="50" r="46" fill="transparent" stroke="currentColor" strokeWidth="4"
                        className={getRingColor()}
                        strokeLinecap="round"
                        strokeDasharray={circleCircumference}
                        animate={{ strokeDashoffset }}
                        transition={{ duration: 1, ease: "linear" }}
                      />
                    )}
                  </svg>
                  <motion.span
                    animate={{ y: [-4, 4, -4] }}
                    transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                    className={`absolute inset-0 flex items-center justify-center text-5xl md:text-6xl drop-shadow-lg ${isUpcoming || isCompleted ? 'opacity-50 grayscale' : ''}`}
                  >
                    {currentItem.icon}
                  </motion.span>
                </div>

                <h2 className={`text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2 ${headerColorClass}`}>
                  {(!isUpcoming && !isCompleted) && <span className={`w-2 h-2 rounded-full ${dotColorClass}`} />} {headerLabel}
                </h2>

                <h1 className={`text-3xl md:text-4xl font-black mb-3 tracking-tight ${isCompleted ? 'text-slate-500 line-through decoration-emerald-500/50' : 'text-slate-100'}`}>
                  {currentItem.activity}
                </h1>
                <p className="text-slate-400 text-sm mb-6 max-w-xs leading-relaxed">{currentItem.description}</p>

                {/* Live Timing Dashboard */}
                <div className="flex flex-col items-center justify-center bg-black/40 px-8 py-5 rounded-3xl border border-white/5 w-full shadow-inner mb-6">
                  <div className="flex w-full items-center justify-between font-bold">
                    <span className="text-xs text-slate-500 uppercase tracking-widest">{currentItem.time}</span>
                    <motion.span
                      animate={isActive || isOverdue ? { opacity: [1, 0.4, 1] } : {}}
                      transition={{ repeat: Infinity, duration: 2 }}
                      className={`text-sm ${timerColor}`}
                    >
                      {countStr}
                    </motion.span>
                    <span className="text-xs text-slate-500 uppercase tracking-widest">{currentItem.endTime}</span>
                  </div>

                  {/* Linear Progress Bar Backup */}
                  {(!isUpcoming && !isCompleted) && (
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mt-3">
                      <motion.div
                        className={`h-full ${isOverdue ? 'bg-red-500' : 'bg-gradient-to-r from-indigo-600 to-indigo-400'}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 1, ease: 'linear' }}
                      />
                    </div>
                  )}
                </div>

                {/* Up Next Preview */}
                {nextItem && (
                  <div className="text-xs font-bold text-slate-400 mb-8 w-full text-left bg-slate-800/30 p-4 rounded-xl border border-white/5 flex items-center gap-4">
                    <span className="p-3 bg-slate-900 rounded-xl text-slate-300 text-lg shadow-inner border border-white/5">{nextItem.icon}</span>
                    <div className="flex-1">
                      <span className="uppercase tracking-[0.2em] text-[9px] text-indigo-400/80 block mb-1 font-bold">Up Next</span>
                      <div className="flex justify-between items-center w-full">
                        <span className="text-slate-100 font-extrabold text-sm tracking-tight">{nextItem.activity}</span>
                        <span className="text-slate-400 font-mono tracking-tighter text-[10px] bg-black/50 px-2 py-0.5 rounded-md border border-white/5">{nextItem.time}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Panel */}
                <div className="flex w-full gap-3">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setActiveFocusIndex(-1)}
                    className="px-6 py-4 rounded-2xl text-slate-500 border border-slate-700/50 hover:bg-white/5 hover:text-slate-300 hover:border-slate-600 font-bold transition-all"
                  >
                    {isCompleted ? 'Close' : 'Minimize'}
                  </motion.button>
                  <motion.button
                    whileTap={!isButtonDisabled ? { scale: 0.95 } : {}}
                    onClick={() => {
                      if (!isButtonDisabled) {
                        updateStatus(activeFocusIndex, 'completed');
                        setActiveFocusIndex(-1);
                      }
                    }}
                    disabled={isButtonDisabled}
                    title={isUpcoming ? "Available when task starts" : ""}
                    className={`flex-1 py-4 rounded-2xl font-black shadow-lg transition-colors flex justify-center items-center gap-2 ${isButtonDisabled ? 'bg-slate-800/40 text-slate-600 shadow-none border border-white/5 cursor-not-allowed' : 'text-white bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/20'}`}
                  >
                    <CheckCircle size={22} strokeWidth={2.5} /> {isCompleted ? 'Completed' : 'Mark Done'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}