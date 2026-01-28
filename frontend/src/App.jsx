import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import SupplierDashboard from "./pages/SupplierDashboard";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./auth/ProtectedRoute";
import { getRole, isLoggedIn } from "./auth/auth";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<Login />} />

      {/* Admin-only */}
      <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
        <Route path="/admin" element={<AdminDashboard />} />
      </Route>

      {/* Supplier-only */}
      <Route element={<ProtectedRoute allowedRoles={["supplier"]} />}>
        <Route path="/supplier" element={<SupplierDashboard />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function HomeRedirect() {
  if (!isLoggedIn()) return <Navigate to="/login" replace />;
  return <Navigate to={getRole() === "admin" ? "/admin" : "/supplier"} replace />;
}
