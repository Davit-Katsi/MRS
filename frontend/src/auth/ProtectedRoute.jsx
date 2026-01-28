import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { getRole, isLoggedIn } from "./auth";

export default function ProtectedRoute({ allowedRoles }) {
  if (!isLoggedIn()) {
    return <Navigate to="/login" replace />;
  }

  const role = getRole();
  if (allowedRoles && !allowedRoles.includes(role)) {
    // logged in but wrong role → send to their dashboard
    return <Navigate to={role === "admin" ? "/admin" : "/supplier"} replace />;
  }

  return <Outlet />;
}
