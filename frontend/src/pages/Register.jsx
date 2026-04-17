import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { LockKeyhole, Mail, User, GraduationCap, IdCard, Layers, Eye, EyeOff, ChevronDown, Check, Tag } from "lucide-react";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "student",
    rollNumber: "",
    section: "",
  });
  
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);

  // Close dropdown on outside click
  const dropdownRef = useRef(null);
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setRoleDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleRoleSelect(role) {
    setForm((prev) => ({ ...prev, role }));
    setRoleDropdownOpen(false);
  }

  // Basic password strength logic
  const calculateStrength = (pwd) => {
    let score = 0;
    if (pwd.length >= 6) score++;
    if (pwd.length >= 10) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return score; // Max 5
  };
  const strengthScore = calculateStrength(form.password);
  const strengthLabels = ["Super Weak", "Weak", "Fair", "Good", "Strong", "Excellent"];
  const strengthColors = ["bg-slate-700", "bg-red-500", "bg-orange-400", "bg-yellow-400", "bg-emerald-400", "bg-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.5)]"];

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      return setError("Passwords do not match.");
    }
    if (form.password.length < 6) {
      return setError("Password must be at least 6 characters.");
    }
    if (form.role === "student" && !form.rollNumber) {
      return setError("Roll number is required for students.");
    }

    setLoading(true);
    try {
      await register(form);
      navigate("/");
    } catch (err) {
      const code = err.code || "";
      if (code.includes("email-already-in-use")) {
        setError("This email is already registered. Please log in.");
      } else if (code.includes("invalid-email")) {
        setError("Please enter a valid email address.");
      } else {
        setError(err.message || "Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  // Premium input styling class
  const inputClass = "w-full bg-white/[0.03] border border-white/[0.08] rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/40 transition-all duration-300 backdrop-blur-sm p-3.5 pl-12 shadow-inner group-hover:bg-white/[0.04]";
  const labelClass = "block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1";

  return (
    <div className="auth-bg flex items-center justify-center min-h-screen px-4 py-12 relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />

      <div className="w-full max-w-[420px] relative z-10 animate-fade-in">
        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 shadow-[0_8px_32px_rgba(99,102,241,0.4)] bg-gradient-to-br from-indigo-500 to-purple-600">
            <GraduationCap size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">
            Create Account
          </h1>
          <p className="text-slate-400 text-[14px] mt-2">Join the next-gen AI curriculum</p>
        </div>

        {/* Card */}
        <div className="p-8 rounded-3xl bg-[#0f0f1a]/80 backdrop-blur-2xl border border-white/[0.08] shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] shadow-purple-900/10">
          {error && (
            <div className="mb-6 px-4 py-3 rounded-xl text-[13px] font-medium text-red-300 bg-red-500/10 border border-red-500/20 shadow-inner flex items-center gap-2 animate-fade-in">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name */}
            <div>
              <label className={labelClass}>Full Name</label>
              <div className="relative group">
                <User size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400/80 pointer-events-none group-focus-within:text-purple-400 transition-colors duration-300" />
                <input
                  name="name"
                  type="text"
                  required
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Aditya Kumar"
                  className={inputClass}
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className={labelClass}>Email Address</label>
              <div className="relative group">
                <Mail size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400/80 pointer-events-none group-focus-within:text-purple-400 transition-colors duration-300" />
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="you@school.edu"
                  className={inputClass}
                />
              </div>
            </div>

            {/* Custom Role Dropdown */}
            <div>
              <label className={labelClass}>Account Role</label>
              <div className="relative group" ref={dropdownRef}>
                <div 
                  onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
                  className={`w-full flex items-center justify-between bg-white/[0.03] border ${roleDropdownOpen ? 'border-purple-500/40 ring-2 ring-purple-500/40 bg-white/[0.05]' : 'border-white/[0.08] hover:bg-white/[0.04]'} rounded-xl transition-all duration-300 backdrop-blur-sm p-3.5 pl-12 shadow-inner cursor-pointer select-none`}
                >
                  <Tag size={20} className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-300 ${roleDropdownOpen ? 'text-purple-400' : 'text-slate-400/80'}`} />
                  <span className={form.role ? 'text-purple-300 font-semibold uppercase tracking-wider text-sm' : 'text-slate-500'}>
                    {form.role === "student" ? "👨‍🎓 Student" : "👨‍🏫 Teacher"}
                  </span>
                  <ChevronDown size={18} className={`text-slate-400 transition-transform duration-300 ${roleDropdownOpen ? 'rotate-180 text-purple-400' : ''}`} />
                </div>

                {/* Dropdown Menu */}
                {roleDropdownOpen && (
                  <div className="absolute z-20 w-full mt-2 py-2 rounded-xl bg-[#1a1a2e]/95 backdrop-blur-xl border border-white/[0.1] shadow-xl overflow-hidden animate-slide-up origin-top">
                    <div 
                      onClick={() => handleRoleSelect("student")}
                      className={`px-4 py-3 flex items-center justify-between cursor-pointer transition-colors ${form.role === "student" ? 'bg-purple-500/10' : 'hover:bg-white/[0.04]'}`}
                    >
                      <span className={`text-sm font-medium ${form.role === "student" ? 'text-purple-300' : 'text-slate-300'}`}>👨‍🎓 Student Account</span>
                      {form.role === "student" && <Check size={16} className="text-purple-400" />}
                    </div>
                    <div 
                      onClick={() => handleRoleSelect("teacher")}
                      className={`px-4 py-3 flex items-center justify-between cursor-pointer transition-colors ${form.role === "teacher" ? 'bg-purple-500/10' : 'hover:bg-white/[0.04]'}`}
                    >
                      <span className={`text-sm font-medium ${form.role === "teacher" ? 'text-purple-300' : 'text-slate-300'}`}>👨‍🏫 Teacher Account</span>
                      {form.role === "teacher" && <Check size={16} className="text-purple-400" />}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Student-only Animated Fields */}
            <div className={`space-y-5 overflow-hidden transition-all duration-500 ease-in-out origin-top ${form.role === 'student' ? 'max-h-[300px] opacity-100 scale-100 mt-5' : 'max-h-0 opacity-0 scale-95 mt-0'}`}>
              <div>
                <label className={labelClass}>Roll Number</label>
                <div className="relative group">
                  <IdCard size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400/80 pointer-events-none group-focus-within:text-purple-400 transition-colors duration-300" />
                  <input
                    name="rollNumber"
                    type="text"
                    value={form.rollNumber}
                    onChange={handleChange}
                    placeholder="e.g. 21CS001"
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Section / Class</label>
                <div className="relative group">
                  <Layers size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400/80 pointer-events-none group-focus-within:text-purple-400 transition-colors duration-300" />
                  <input
                    name="section"
                    type="text"
                    value={form.section}
                    onChange={handleChange}
                    placeholder="e.g. CS-A"
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex justify-between items-baseline mb-2">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Password</label>
                {form.password && (
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${strengthScore > 3 ? 'text-emerald-400' : strengthScore > 1 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {strengthLabels[strengthScore]}
                  </span>
                )}
              </div>
              <div className="relative group">
                <LockKeyhole size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400/80 pointer-events-none group-focus-within:text-purple-400 transition-colors duration-300" />
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Min 6 characters"
                  className={inputClass + " pr-12"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              
              {/* password strength bar */}
              {form.password && (
                <div className="flex gap-1 mt-2 h-1 w-full rounded-full overflow-hidden bg-white/5 disabled:opacity-50">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <div 
                      key={level} 
                      className={`h-full flex-1 transition-all duration-500 rounded-full ${strengthScore >= level ? strengthColors[strengthScore] : 'bg-transparent'}`} 
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className={labelClass}>Confirm Password</label>
              <div className="relative group">
                <LockKeyhole size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400/80 pointer-events-none group-focus-within:text-purple-400 transition-colors duration-300" />
                <input
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  placeholder="Repeat password"
                  className={inputClass + " pr-12"}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold py-4 rounded-xl shadow-[0_8px_20px_rgba(99,102,241,0.25)] transition-all duration-300 transform hover:-translate-y-0.5 mt-4 flex items-center justify-center gap-2 disabled:opacity-70 disabled:hover:translate-y-0 text-sm tracking-wide uppercase"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                   <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                   Initializing...
                </span>
              ) : "Create Account"}
            </button>
          </form>

          <p className="text-center text-[13px] text-slate-400 mt-8">
            Already have an account?{" "}
            <Link to="/login" className="text-purple-400 hover:text-purple-300 font-semibold transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
