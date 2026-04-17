import useTitle from "../hooks/useTitle";
import React, { useState, useEffect, useRef } from "react";
import { collection, query, orderBy, onSnapshot, doc, getDoc, setDoc, addDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { Link } from "react-router-dom";
import { Sparkles, Clock, Link as LinkIcon, CheckCircle, Play, Save, ChevronLeft, ChevronRight } from "lucide-react";
import API_BASE from "../lib/api";

// ── Time Utilities ────────────────────────────────────────────────────────────
function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + (m || 0);
}

function getDifficultyColor(diff) {
  const d = diff?.toLowerCase();
  if (d === 'easy') return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
  if (d === 'hard') return "text-red-400 bg-red-500/10 border-red-500/20";
  return "text-amber-400 bg-amber-500/10 border-amber-500/20"; // Medium
}

// ── Main Page Component ───────────────────────────────────────────────────────
export default function FreePeriodTasks() {
  useTitle("Tasks");
  const { currentUser, userProfile } = useAuth();
  const [todayClasses, setTodayClasses] = useState([]);
  const [loadingSchedule, setLoadingSchedule] = useState(true);

  // Free period state
  const [isFreePeriod, setIsFreePeriod] = useState(false);
  const [availableTime, setAvailableTime] = useState(0);

  // Gemini tasks state
  const [generating, setGenerating] = useState(false);
  const [history, setHistory] = useState([]); // [{timestamp, tasks}]
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Saved tasks state
  const [savedTasks, setSavedTasks] = useState([]);

  // Active task state (Timer)
  const [activeTask, setActiveTask] = useState(null); // { task, remainingSeconds, totalSeconds }
  const timerRef = useRef(null);

  // 1. Check Profile completeness
  const isProfileComplete = userProfile?.interests && userProfile?.strengths && userProfile?.careerGoal;

  // 2. Load timetable & determine free period
  useEffect(() => {
    if (!userProfile) return;
    const todayName = new Date().toLocaleDateString("en-US", { weekday: "long" });
    const section = userProfile?.section?.toUpperCase();

    const q = query(collection(db, "timetable"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map(d => d.data());
      const filtered = all.filter(e => e.day === todayName && (!section || e.section?.toUpperCase() === section));
      setTodayClasses(filtered);
      setLoadingSchedule(false);
    });
    return unsub;
  }, [userProfile]);

  useEffect(() => {
    if (loadingSchedule) return;

    const interval = setInterval(() => {
      const now = new Date();
      const nowMins = now.getHours() * 60 + now.getMinutes();
      const SCHOOL_START = 9 * 60; // 9:00 AM
      const SCHOOL_END = 15 * 60; // 3:00 PM

      const isWithinSchoolHours = nowMins >= SCHOOL_START && nowMins <= SCHOOL_END;

      const isClassNow = todayClasses.some(c => {
        const s = timeToMinutes(c.startTime);
        const e = timeToMinutes(c.endTime);
        return nowMins >= s && nowMins < e;
      });

      const free = isWithinSchoolHours && !isClassNow;
      setIsFreePeriod(free);

      if (free) {
        let nextS = Infinity;
        for (let c of todayClasses) {
          let s = timeToMinutes(c.startTime);
          if (s > nowMins && s < nextS) nextS = s;
        }
        if (nextS === Infinity) {
          setAvailableTime(Math.max(0, SCHOOL_END - nowMins));
        } else {
          setAvailableTime(nextS - nowMins);
        }
      } else {
        setAvailableTime(0);
      }
    }, 1000 * 60); // check every minute

    // Run once immediately
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const SCHOOL_START = 9 * 60;
    const SCHOOL_END = 15 * 60;
    const isWithinSchoolHours = nowMins >= SCHOOL_START && nowMins <= SCHOOL_END;

    const isClassNow = todayClasses.some(c => {
      const s = timeToMinutes(c.startTime);
      const e = timeToMinutes(c.endTime);
      return nowMins >= s && nowMins < e;
    });

    const free = isWithinSchoolHours && !isClassNow;
    setIsFreePeriod(free);

    if (free) {
      let nextS = Infinity;
      for (let c of todayClasses) {
        let s = timeToMinutes(c.startTime);
        if (s > nowMins && s < nextS) nextS = s;
      }
      if (nextS === Infinity) {
        setAvailableTime(Math.max(0, SCHOOL_END - nowMins));
      } else {
        setAvailableTime(nextS - nowMins);
      }
    } else {
      setAvailableTime(0);
    }

    return () => clearInterval(interval);
  }, [todayClasses, loadingSchedule]);

  // 3. Load user's saved tasks
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, `users/${currentUser.uid}/tasks`), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setSavedTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [currentUser]);


  // 4. Generate Tasks via Backend
  async function handleGenerateTasks() {
    console.log("Generate clicked. Free period:", isFreePeriod);
    if (generating) return;

    // Cache check (<10 mins within session state)
    if (history.length > 0) {
      const lastGen = history[history.length - 1];
      const ageMs = Date.now() - lastGen.timestamp;
      if (ageMs < 10 * 60 * 1000) {
        // Just move to the latest if we aren't already there
        setHistoryIndex(history.length - 1);
        return;
      }
    }

    setGenerating(true);
    try {
      const payload = {
        availableTime: availableTime || 60, // Default to 60 if not in free period
        interests: userProfile.interests || "General learning",
        strengths: userProfile.strengths || "Adaptable",
        careerGoal: userProfile.careerGoal || "Professional development"
      };

      const res = await fetch(`${API_BASE}/api/generate-tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      const newGen = { timestamp: Date.now(), tasks: data };
      const newHistory = [...history, newGen].slice(-3); // keep last 3
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);

    } catch (err) {
      console.error(err);
      alert("Unable to generate tasks right now. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  // 5. Timer Logic
  function startTaskTimer(task) {
    if (timerRef.current) clearInterval(timerRef.current);
    const totalSeconds = task.duration * 60;
    setActiveTask({ task, remainingSeconds: totalSeconds, totalSeconds });
  }

  useEffect(() => {
    if (activeTask && activeTask.remainingSeconds > 0) {
      timerRef.current = setInterval(() => {
        setActiveTask(prev => {
          if (prev.remainingSeconds <= 1) {
            clearInterval(timerRef.current);
            completeActiveTask(prev.task);
            return { ...prev, remainingSeconds: 0 };
          }
          return { ...prev, remainingSeconds: prev.remainingSeconds - 1 };
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [activeTask]);

  async function completeActiveTask(task) {
    alert("Great job! Task completed!"); // Celebration
    setActiveTask(null);
    if (currentUser) {
      await addDoc(collection(db, `users/${currentUser.uid}/tasks`), {
        title: task.title,
        description: task.description,
        duration: task.duration,
        difficulty: task.difficulty,
        status: "completed",
        createdAt: serverTimestamp()
      });
    }
  }

  // 6. Save Task (Pending)
  async function saveTaskPending(task) {
    if (!currentUser) return;
    try {
      await addDoc(collection(db, `users/${currentUser.uid}/tasks`), {
        title: task.title,
        description: task.description,
        duration: task.duration,
        difficulty: task.difficulty,
        status: "pending",
        createdAt: serverTimestamp()
      });
    } catch(err) {
      console.error(err);
    }
  }

  async function markTaskDone(taskId) {
    if (!currentUser) return;
    try {
      await updateDoc(doc(db, `users/${currentUser.uid}/tasks`, taskId), {
        status: "completed"
      });
    } catch(err) {
      console.error(err);
    }
  }

  const currentTasks = historyIndex >= 0 ? history[historyIndex].tasks : null;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8 pb-32">
      {/* ── Banners ──────────────────────────────────────────────────────── */}
      {!isProfileComplete && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-amber-400 font-semibold mb-1">Incomplete Profile</h3>
            <p className="text-amber-400/80 text-sm">Complete your profile to get personalized AI task suggestions!</p>
          </div>
          <Link to="/student/goals" className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-xl text-sm font-medium transition-colors whitespace-nowrap">
            Profile Setup
          </Link>
        </div>
      )}

      {isFreePeriod ? (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
            <Clock className="text-emerald-400" size={20} />
          </div>
          <div>
            <h3 className="text-emerald-400 font-semibold">Free Period Active!</h3>
            <p className="text-emerald-400/80 text-sm">You have {availableTime} minutes until your next class. Make it productive!</p>
          </div>
        </div>
      ) : (
        <div className="bg-slate-500/10 border border-slate-500/20 rounded-2xl p-4 flex items-center gap-4 text-slate-400">
           <Clock size={20} />
           <span className="text-sm">No free period right now. Come back during your free time!</span>
        </div>
      )}

      {/* ── Profile Summary ─────────────────────────────────────────────── */}
      {isProfileComplete && (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-100">My Profile Summary</h2>
            <Link to="/student/goals" className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
              Edit <LinkIcon size={20} />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Interests</p>
              <p className="text-sm font-medium text-slate-200">{userProfile.interests}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Strengths</p>
              <p className="text-sm font-medium text-slate-200">{userProfile.strengths}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Career Goal</p>
              <p className="text-sm font-medium text-slate-200">{userProfile.careerGoal}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Generate Action ─────────────────────────────────────────────── */}
      <div className="flex flex-col items-center py-6">
        {generating ? (
          <div className="flex flex-col items-center gap-3 animate-pulse">
            <Sparkles size={32} className="text-violet-400" />
            <p className="text-violet-300 font-medium">✨ AI is generating personalized tasks for you...</p>
          </div>
        ) : (
          <button 
            onClick={handleGenerateTasks}
            className="group relative px-8 py-4 bg-violet-600 hover:bg-violet-500 text-white rounded-2xl font-bold text-lg transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-violet-600/30 overflow-hidden"
          >
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 mix-blend-overlay"></div>
            <div className="relative flex items-center gap-3">
              <Sparkles size={24} className="group-hover:rotate-12 transition-transform" />
              {isFreePeriod ? `You have ${availableTime} minutes. Generate tasks` : "Generate tasks for later practice"}
            </div>
          </button>
        )}
      </div>

      {/* ── History Controls ────────────────────────────────────────────── */}
      {!generating && history.length > 0 && (
        <div className="flex items-center justify-end gap-4 mb-2">
           <button 
             disabled={historyIndex <= 0}
             onClick={() => setHistoryIndex(i => i - 1)}
             className="p-2 rounded-lg bg-black/20 text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
           >
              <ChevronLeft size={20} />
           </button>
           <span className="text-xs text-slate-500 font-medium">Generation {historyIndex + 1} of {history.length}</span>
           <button 
             disabled={historyIndex >= history.length - 1}
             onClick={() => setHistoryIndex(i => i + 1)}
             className="p-2 rounded-lg bg-black/20 text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
           >
              <ChevronRight size={20} />
           </button>
        </div>
      )}

      {/* ── Tasks Grid ─────────────────────────────────────────────────── */}
      {currentTasks && !generating && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {currentTasks.map((t, i) => (
            <div key={i} className="glass-card flex flex-col p-5 hover:border-white/10 transition-all">
              <div className="flex items-start justify-between mb-4">
                 <h3 className="font-bold text-slate-100 leading-snug">{t.title}</h3>
                 <div className={`badge text-[10px] ${getDifficultyColor(t.difficulty)} px-2`}>
                   {t.difficulty}
                 </div>
              </div>
              
              <p className="text-sm text-slate-400 flex-1 mb-6">
                {t.description}
              </p>

              <div className="flex items-center justify-between mb-5 pb-5 border-b border-white/5">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                  <Clock size={20} />
                  {t.duration} mins
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button 
                  onClick={() => startTaskTimer(t)}
                  className="flex-1 bg-violet-600/20 hover:bg-violet-600 text-violet-300 hover:text-white py-2 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <Play size={20} /> Start Task
                </button>
                <button 
                  onClick={() => saveTaskPending(t)}
                  className="w-10 h-10 bg-black/20 hover:bg-white/5 text-slate-400 rounded-xl flex items-center justify-center transition-colors tooltip-trigger"
                  title="Save for later"
                >
                  <Save size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Saved Tasks ────────────────────────────────────────────────── */}
      {savedTasks.length > 0 && (
        <div className="pt-12">
          <h2 className="text-xl font-bold text-slate-100 mb-6 flex items-center gap-3">
            <Save size={20} className="text-violet-400" /> Saved Tasks
          </h2>
          <div className="space-y-3">
            {savedTasks.map(task => (
              <div key={task.id} className="glass-card flex items-center justify-between p-4">
                <div>
                  <h4 className={`font-semibold ${task.status === 'completed' ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                    {task.title}
                  </h4>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-xs text-slate-500">{task.duration} mins</span>
                    <span className={`badge text-[10px] ${getDifficultyColor(task.difficulty)} px-1.5 py-0`}>
                      {task.difficulty}
                    </span>
                  </div>
                </div>
                {task.status === 'pending' ? (
                  <button 
                    onClick={() => markTaskDone(task.id)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-sm font-semibold transition-colors"
                  >
                    <CheckCircle size={20} /> Mark Done
                  </button>
                ) : (
                  <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                    <CheckCircle size={20} /> Completed
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Active Task Modal / Sticky Timer ────────────────────────────── */}
      {activeTask && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-md p-4 animate-slide-up z-50">
          <div className="glass-card shadow-2xl border-violet-500/30 overflow-hidden relative p-5">
             <div 
               className="absolute top-0 left-0 h-1 bg-violet-500 transition-all duration-1000 ease-linear"
               style={{ width: `${(1 - activeTask.remainingSeconds / activeTask.totalSeconds) * 100}%` }}
             />
             <div className="flex items-center justify-between mb-2">
               <h4 className="font-bold text-slate-100 truncate pr-4">{activeTask.task.title}</h4>
               <button onClick={() => setActiveTask(null)} className="text-xs text-slate-400 hover:text-white">Cancel</button>
             </div>
             
             <div className="flex items-center gap-3">
               <div className="w-12 h-12 rounded-xl bg-violet-500/20 text-violet-400 flex items-center justify-center font-bold text-lg border border-violet-500/30">
                 {Math.floor(activeTask.remainingSeconds / 60)}:{(activeTask.remainingSeconds % 60).toString().padStart(2, '0')}
               </div>
               <p className="text-xs text-slate-400 leading-tight">
                 Keep focused! You are making progress. Closing this banner will cancel the active timer.
               </p>
             </div>
          </div>
        </div>
      )}

    </div>
  );
}
