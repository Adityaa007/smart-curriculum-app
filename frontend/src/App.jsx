import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import TeacherDashboard from "./pages/TeacherDashboard";
import StudentDashboard from "./pages/StudentDashboard";

function RootRedirect() {
  const { currentUser, userProfile, loading } = useAuth();

  // Still fetching Firestore profile — wait
  if (loading) return null;

  if (!currentUser) return <Navigate to="/login" replace />;

  // Firestore document missing — user registered in Auth but no profile saved
  if (userProfile?._noDocument) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0f0f1a] text-center px-6">
        <div>
          <p className="text-red-400 font-semibold text-lg mb-2">Account setup incomplete</p>
          <p className="text-slate-400 text-sm">Your account exists but your profile was not saved correctly. Please register again or contact support.</p>
        </div>
      </div>
    );
  }

  if (userProfile?.role === "teacher") return <Navigate to="/teacher" replace />;
  if (userProfile?.role === "student") return <Navigate to="/student" replace />;

  // Logged in but userProfile still null (shouldn't happen, but guard anyway)
  return null;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/teacher/*"
        element={
          <ProtectedRoute requiredRole="teacher">
            <TeacherDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/*"
        element={
          <ProtectedRoute requiredRole="student">
            <StudentDashboard />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}
