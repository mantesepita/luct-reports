import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./components/Login";
import StudentDashboard from "./components/StudentDashboard";
import LecturerDashboard from "./components/LecturerDashboard";
import PRLDashboard from "./components/PRLDashboard";
import PLDashboard from "./components/PRDashboard";
import { useAuth } from "./context/AuthContext";

function App() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="container text-center mt-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <h3 className="mt-3">Loading...</h3>
      </div>
    );
  }

  // Normalize role to handle both 'principal_lecturer' and 'prl' formats
  const normalizeRole = (role) => {
    if (role === 'principal_lecturer') return 'prl';
    if (role === 'program_leader') return 'pl';
    return role;
  };

  const normalizedRole = user ? normalizeRole(user.role) : null;

  return (
    <Routes>
      {/* Root route - redirect based on user status */}
      <Route 
        path="/" 
        element={
          user ? (
            <Navigate to={`/${normalizedRole}-dashboard`} replace />
          ) : (
            <Login />
          )
        } 
      />

      {/* Student Dashboard */}
      <Route
        path="/student-dashboard"
        element={
          normalizedRole === "student" ? (
            <StudentDashboard user={user} onLogout={logout} />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />

      {/* Lecturer Dashboard */}
      <Route
        path="/lecturer-dashboard"
        element={
          normalizedRole === "lecturer" ? (
            <LecturerDashboard user={user} onLogout={logout} />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />

      {/* PRL Dashboard */}
      <Route
        path="/prl-dashboard"
        element={
          normalizedRole === "prl" ? (
            <PRLDashboard user={user} onLogout={logout} />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />

      {/* PL Dashboard */}
      <Route
        path="/pl-dashboard"
        element={
          normalizedRole === "pl" ? (
            <PLDashboard user={user} onLogout={logout} />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />

      {/* Catch all - redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;