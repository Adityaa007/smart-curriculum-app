import useTitle from "../hooks/useTitle";
import React, { useState, useEffect } from "react";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { Activity, Check, AlertCircle, Globe } from "lucide-react";

export default function NetworkSettings() {
  useTitle("Settings");
  const { currentUser } = useAuth();

  const [ipStart, setIpStart] = useState("");
  const [ipEnd, setIpEnd] = useState("");
  const [ipPrefix, setIpPrefix] = useState("");
  const [simulateCampus, setSimulateCampus] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  // Load existing settings
  useEffect(() => {
    async function load() {
      try {
        const snap = await getDoc(doc(db, "settings", "network"));
        if (snap.exists()) {
          const data = snap.data();
          setIpStart(data.ipStart || "");
          setIpEnd(data.ipEnd || "");
          setIpPrefix(data.ipPrefix || "");
          setSimulateCampus(data.simulateCampus || false);
        }
      } catch (e) {
        console.error("Error loading network settings:", e);
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave() {
    setSaving(true);
    setMsg({ type: "", text: "" });
    try {
      await setDoc(doc(db, "settings", "network"), {
        ipStart: ipStart.trim(),
        ipEnd: ipEnd.trim(),
        ipPrefix: ipPrefix.trim(),
        simulateCampus,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser?.uid || "",
      });
      setMsg({ type: "success", text: "Network settings saved successfully!" });
    } catch (e) {
      setMsg({ type: "error", text: `Failed to save: ${e.message}` });
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="glass-card p-8 flex flex-col items-center gap-4 text-center">
          <div className="model-loading-spinner" />
          <p className="text-slate-300 font-medium">Loading network settings…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="badge bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">Network</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-100">Network Settings</h1>
        <p className="text-slate-400 text-sm mt-1">
          Configure the college Wi-Fi network range for automatic proximity attendance
        </p>
      </div>

      {/* Messages */}
      {msg.text && (
        <div
          className={`mb-4 px-4 py-3 rounded-xl text-sm flex items-center gap-2 animate-slide-up ${
            msg.type === "success"
              ? "text-emerald-300 bg-emerald-500/10 border border-emerald-500/20"
              : "text-red-300 bg-red-500/10 border border-red-500/20"
          }`}
        >
          {msg.type === "success" ? <Check size={16} /> : <AlertCircle size={16} />}
          {msg.text}
        </div>
      )}

      {/* IP Range Settings */}
      <div className="glass-card p-6 mb-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(6,182,212,0.15)", border: "1px solid rgba(6,182,212,0.3)" }}>
            <Globe size={20} className="text-cyan-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-100">IP Range Configuration</p>
            <p className="text-xs text-slate-400">Students on IPs within this range will be auto-verified</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* IP Prefix (simple) */}
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">
              IP Prefix <span className="text-slate-600">(simple match)</span>
            </label>
            <input
              type="text"
              value={ipPrefix}
              onChange={(e) => setIpPrefix(e.target.value)}
              placeholder="e.g. 192.168.1"
              className="input-dark"
            />
            <p className="text-xs text-slate-600 mt-1">Any IP starting with this prefix will be verified</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.06)" }} />
            <span className="text-xs text-slate-600">or use exact range</span>
            <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.06)" }} />
          </div>

          {/* IP Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Range Start</label>
              <input
                type="text"
                value={ipStart}
                onChange={(e) => setIpStart(e.target.value)}
                placeholder="e.g. 192.168.1.1"
                className="input-dark"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Range End</label>
              <input
                type="text"
                value={ipEnd}
                onChange={(e) => setIpEnd(e.target.value)}
                placeholder="e.g. 192.168.1.255"
                className="input-dark"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Simulate Toggle */}
      <div className="glass-card p-6 mb-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)" }}>
            <Activity size={20} className="text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-100">Development & Testing</p>
            <p className="text-xs text-slate-400">Settings for local development and testing environments</p>
          </div>
        </div>

        <div
          className="flex items-center justify-between p-4 rounded-xl cursor-pointer transition-colors"
          style={{
            background: simulateCampus ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.02)",
            border: `1px solid ${simulateCampus ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.06)"}`,
          }}
          onClick={() => setSimulateCampus(!simulateCampus)}
        >
          <div>
            <p className="text-sm font-semibold text-slate-200">Simulate Campus Network</p>
            <p className="text-xs text-slate-400 mt-0.5">
              When enabled, all students are auto-verified regardless of their actual IP address.
              Use this for testing on localhost.
            </p>
          </div>
          {/* Toggle switch */}
          <div
            className="w-12 h-7 rounded-full shrink-0 ml-4 relative transition-colors duration-200"
            style={{
              background: simulateCampus ? "#10b981" : "rgba(255,255,255,0.1)",
            }}
          >
            <div
              className="w-5 h-5 rounded-full bg-white absolute top-1 transition-all duration-200"
              style={{ left: simulateCampus ? "calc(100% - 24px)" : "4px" }}
            />
          </div>
        </div>

        {simulateCampus && (
          <div className="mt-3 flex items-start gap-2 px-3 py-2 rounded-lg"
            style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.15)" }}>
            <AlertCircle size={14} className="text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-300">
              <strong>Warning:</strong> Simulation mode is active. All students will be marked as verified.
              Disable this in production.
            </p>
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="glass-card p-6 mb-5">
        <p className="text-sm font-bold text-slate-200 mb-3">How Wi-Fi Attendance Works</p>
        <div className="space-y-2.5">
          {[
            "Teacher starts an attendance session (QR or Face)",
            "Student's browser silently checks their network every 30 seconds",
            "If the student's IP matches the configured college range, they're auto-verified",
            "A small 📶 badge appears next to their name on the teacher's dashboard",
            "No action required from the student — it's fully automatic",
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold text-cyan-400"
                style={{ background: "rgba(6,182,212,0.15)", border: "1px solid rgba(6,182,212,0.25)" }}>
                {i + 1}
              </span>
              <p className="text-xs text-slate-400">{step}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="btn-primary flex items-center justify-center gap-2"
        style={{ opacity: saving ? 0.6 : 1 }}
      >
        <Check size={18} />
        {saving ? "Saving…" : "Save Network Settings"}
      </button>
    </div>
  );
}
