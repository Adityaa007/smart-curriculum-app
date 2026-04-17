import useTitle from "../hooks/useTitle";
import React, { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { Calendar } from "lucide-react";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const DAY_COLORS = {
  Monday:    { accent: "#6366f1", bg: "rgba(99,102,241,0.10)",  border: "rgba(99,102,241,0.22)" },
  Tuesday:   { accent: "#8b5cf6", bg: "rgba(139,92,246,0.10)", border: "rgba(139,92,246,0.22)" },
  Wednesday: { accent: "#10b981", bg: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.22)" },
  Thursday:  { accent: "#f59e0b", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.22)" },
  Friday:    { accent: "#ef4444", bg: "rgba(239,68,68,0.10)",  border: "rgba(239,68,68,0.22)"  },
  Saturday:  { accent: "#06b6d4", bg: "rgba(6,182,212,0.10)",  border: "rgba(6,182,212,0.22)"  },
};

function formatTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hour = parseInt(h, 10);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
}

// ── Today pill ──────────────────────────────────────────────────────────────
const TODAY = new Date().toLocaleDateString("en-US", { weekday: "long" });

// ── Weekly Calendar Table ───────────────────────────────────────────────────
function WeeklyTable({ byDay, activeDays }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/[0.07]">
      <table className="w-full min-w-[640px] border-collapse">
        <thead>
          <tr>
            {activeDays.map((day) => {
              const { accent, bg, border } = DAY_COLORS[day];
              const isToday = day === TODAY;
              return (
                <th
                  key={day}
                  className="px-3 py-3 text-left"
                  style={{
                    background: isToday ? bg : "rgba(255,255,255,0.02)",
                    borderBottom: `2px solid ${isToday ? accent : "rgba(255,255,255,0.06)"}`,
                    minWidth: "140px",
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className="text-xs font-bold uppercase tracking-wider"
                      style={{ color: accent }}
                    >
                      {day.slice(0, 3)}
                    </span>
                    {isToday && (
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: accent, color: "#fff" }}
                      >
                        TODAY
                      </span>
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {/* Find max entries across days to determine row count */}
          {Array.from({ length: Math.max(...activeDays.map((d) => byDay[d].length)) }).map(
            (_, rowIdx) => (
              <tr key={rowIdx} className="border-t border-white/[0.04]">
                {activeDays.map((day) => {
                  const entry = byDay[day][rowIdx];
                  const { accent, bg, border } = DAY_COLORS[day];
                  const isToday = day === TODAY;
                  return (
                    <td
                      key={day}
                      className="px-3 py-2.5 align-top"
                      style={{
                        background: isToday ? "rgba(255,255,255,0.015)" : "transparent",
                      }}
                    >
                      {entry ? (
                        <div
                          className="rounded-xl px-3 py-2.5 transition-transform hover:scale-[1.02]"
                          style={{ background: bg, border: `1px solid ${border}` }}
                        >
                          <p className="text-sm font-semibold text-slate-200 leading-snug mb-1">
                            {entry.subject}
                          </p>
                          <p className="text-[11px] font-medium" style={{ color: accent }}>
                            {formatTime(entry.startTime)} – {formatTime(entry.endTime)}
                          </p>
                          {entry.room && (
                            <p className="text-[11px] text-slate-500 mt-0.5">📍 {entry.room}</p>
                          )}
                          {entry.teacherName && (
                            <p className="text-[11px] text-slate-600 mt-0.5 truncate">
                              {entry.teacherName}
                            </p>
                          )}
                        </div>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Export ─────────────────────────────────────────────────────────────
export default function StudentTimetable() {
  useTitle("My Timetable");
  const { userProfile } = useAuth();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "timetable"), orderBy("createdAt", "asc"));
    return onSnapshot(q, (snap) => {
      setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, []);

  // Filter by the student's section (case-insensitive)
  const section = userProfile?.section?.toUpperCase();
  const filtered = section
    ? entries.filter((e) => e.section?.toUpperCase() === section)
    : entries;

  const byDay = DAYS.reduce((acc, day) => {
    acc[day] = filtered
      .filter((e) => e.day === day)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    return acc;
  }, {});

  const activeDays = DAYS.filter((d) => byDay[d].length > 0);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">My Timetable</h1>
        <p className="text-slate-400 text-sm mt-1">
          {section ? `Section ${section} · Weekly schedule` : "All sections · Weekly schedule"}
        </p>
      </div>

      {loading ? (
        <div className="glass-card py-16 text-center text-slate-500">Loading schedule…</div>
      ) : activeDays.length === 0 ? (
        <div className="glass-card p-14 text-center">
          <Calendar size={40} className="text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400 font-medium mb-1">No classes scheduled yet</p>
          <p className="text-sm text-slate-600">
            {section
              ? `No entries found for Section ${section}. Ask your teacher to add the timetable.`
              : "Ask your teacher to add the class schedule."}
          </p>
        </div>
      ) : (
        <>
          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 mb-5">
            {activeDays.map((day) => (
              <div key={day} className="flex items-center gap-1.5 text-xs text-slate-400">
                <span
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{ background: DAY_COLORS[day].accent }}
                />
                {day}
                <span className="text-slate-600">({byDay[day].length})</span>
              </div>
            ))}
          </div>

          {/* Weekly table */}
          <WeeklyTable byDay={byDay} activeDays={activeDays} />

          {/* Class count */}
          <p className="text-xs text-slate-600 mt-4 text-right">
            {filtered.length} class{filtered.length !== 1 ? "es" : ""} per week
          </p>
        </>
      )}
    </div>
  );
}
