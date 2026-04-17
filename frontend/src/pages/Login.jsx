import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { LockKeyhole, Mail, GraduationCap } from "lucide-react";

export default function Login() {
  const { login, currentUser, userProfile, loading } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading2, setLoading2] = useState(false);

  // ── Redirect once Firebase auth + Firestore profile are both ready ──
  // This fires whenever currentUser or userProfile changes.
  // After a successful login, onAuthStateChanged sets currentUser,
  // then fetchProfile sets userProfile. Once both are set and
  // loading is false, we navigate to "/" → RootRedirect picks the right dashboard.
  useEffect(() => {
    if (!loading && currentUser && userProfile) {
      console.log("[Login] Auth complete, redirecting. Role:", userProfile.role);
      navigate("/", { replace: true });
    }
  }, [loading, currentUser, userProfile, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading2(true);
    try {
      await login(email, password);
      // Navigation is handled by the useEffect above once
      // onAuthStateChanged fires and userProfile loads from Firestore.
      // We don't navigate() here to avoid the race condition.
    } catch (err) {
      console.error("[Login] Error:", err.code, err.message);
      const code = err.code || "";
      if (code.includes("user-not-found") || code.includes("wrong-password") || code.includes("invalid-credential")) {
        setError("Invalid email or password. Please try again.");
      } else if (code.includes("too-many-requests")) {
        setError("Too many failed attempts. Please wait a moment.");
      } else {
        setError(err.message || "Login failed. Please try again.");
      }
    } finally {
      setLoading2(false);
    }
  }

  return (
    <div className="auth-bg flex items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-sm">
        {/* Logo / Brand */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-lg"
            style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}
          >
            <GraduationCap size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold gradient-text">SmartCurriculum</h1>
          <p className="text-slate-400 text-sm mt-1">Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="p-8 rounded-2xl bg-[#0f0f1a]/80 backdrop-blur-xl border border-white/[0.08] shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] shadow-purple-900/10">
          {error && (
            <div className="mb-6 px-4 py-3 rounded-xl text-[13px] font-medium text-red-300 bg-red-500/10 border border-red-500/20 shadow-inner">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Email Address</label>
              <div className="relative group">
                <Mail size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400/80 pointer-events-none group-focus-within:text-purple-400 transition-colors duration-300" />
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/40 transition-all duration-300 backdrop-blur-sm p-3.5 pl-12 shadow-inner"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Password</label>
              <div className="relative group">
                <LockKeyhole size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400/80 pointer-events-none group-focus-within:text-purple-400 transition-colors duration-300" />
                <input
                  id="login-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/40 transition-all duration-300 backdrop-blur-sm p-3.5 pl-12 shadow-inner"
                />
              </div>
            </div>

            <button
              id="login-submit"
              type="submit"
              disabled={loading2}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-500/25 transition-all duration-300 transform hover:-translate-y-0.5 mt-2 flex items-center justify-center disabled:opacity-70 disabled:hover:translate-y-0"
            >
              {loading2 ? (
                <span className="flex items-center gap-2">
                   <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                   Signing in...
                </span>
              ) : "Sign In"}
            </button>
          </form>

          <p className="text-center text-[13px] text-slate-400 mt-8">
            Don't have an account?{" "}
            <Link to="/register" className="text-purple-400 hover:text-purple-300 font-semibold transition-colors">
              Request access
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
