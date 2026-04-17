import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Home, Calendar, ClipboardCheck, BarChart, BookOpen, Star, LogOut, Menu, X, QrCode, Camera, Globe } from "lucide-react";

const TEACHER_NAV = [
  { to: "/teacher", label: "Dashboard", icon: Home, end: true },
  { to: "/teacher/timetable", label: "Timetable", icon: Calendar },
  { to: "/teacher/attendance", label: "Attendance", icon: ClipboardCheck },
  { to: "/teacher/face-register", label: "Face Register", icon: Camera },
  { to: "/teacher/network-settings", label: "Network Settings", icon: Globe },
  { to: "/teacher/reports", label: "Reports", icon: BarChart },
];

const STUDENT_NAV = [
  { to: "/student", label: "Dashboard", icon: Home, end: true },
  { to: "/student/attendance", label: "My Attendance", icon: ClipboardCheck },
  { to: "/student/routine", label: "My Routine", icon: Calendar },
  { to: "/student/tasks", label: "Free Period Tasks", icon: BookOpen },
  { to: "/student/goals", label: "Career Goals", icon: Star },
];

export default function Sidebar({ mobileOpen = false, setMobileOpen = () => {} }) {
  const { userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const navItems = userProfile?.role === "teacher" ? TEACHER_NAV : STUDENT_NAV;
  const roleLabel = userProfile?.role === "teacher" ? "Teacher" : "Student";
  const initials = userProfile?.name
    ? userProfile.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "??";

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm transition-opacity" 
          onClick={() => setMobileOpen(false)} 
        />
      )}
      
      <aside
        style={{ width: collapsed ? "72px" : "230px" }}
        className={`sidebar-shell flex flex-col h-full transition-all duration-300 ease-in-out shrink-0
          fixed md:relative z-50 inset-y-0 left-0
          ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        {/* Top — branding + toggle */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-white/[0.06]">
        {!collapsed && (
          <span className="text-sm font-bold gradient-text tracking-wide truncate">
            SmartCurriculum
          </span>
        )}
        <button
          onClick={() => {
            if (window.innerWidth < 768) {
              setMobileOpen(false);
            } else {
              setCollapsed((c) => !c);
            }
          }}
          className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors ml-auto"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <X size={18} className="md:hidden" />
          <div className="hidden md:block">
            {collapsed ? <Menu size={18} /> : <X size={18} />}
          </div>
        </button>
      </div>

      {/* Avatar + name */}
      <div className={`flex ${collapsed ? "justify-center" : "items-center gap-3"} px-4 py-4`}>
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold text-white"
          style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}
        >
          {initials}
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-sm font-semibold text-slate-100 truncate">{userProfile?.name}</p>
            <p className="text-[11px] text-slate-400 truncate">{roleLabel}</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group ${
                isActive
                  ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
                  : "text-slate-400 hover:text-slate-100 hover:bg-white/[0.05]"
              }`
            }
            onClick={() => {
              if (window.innerWidth < 768) setMobileOpen(false);
            }}
            title={collapsed ? label : undefined}
          >
            <Icon size={18} className="shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-2 pb-4 border-t border-white/[0.06] pt-3">
        <button
          onClick={handleLogout}
          className={`flex items-center ${collapsed ? "justify-center" : "gap-3"} w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all`}
          title={collapsed ? "Logout" : undefined}
        >
          <LogOut size={18} className="shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
    </>
  );
}
