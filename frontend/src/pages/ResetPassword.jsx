import React, { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/client";

export default function ResetPassword() {
  const location = useLocation();
  const navigate = useNavigate();

  const token = useMemo(() => {
    return new URLSearchParams(location.search).get("token") || "";
  }, [location.search]);

  const [newPassword, setNewPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!token) {
      setErr("Missing token");
      return;
    }
    setErr("");
    setMsg("");
    setLoading(true);
    try {
      const res = await api.post("/api/auth/reset-password", { token, newPassword });
      setMsg(res.data?.message || "Password updated");
      setTimeout(() => navigate("/login"), 1200);
    } catch (e2) {
      setErr(e2?.response?.data?.message || "Server error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "60px auto", padding: 16 }}>
      <h2 style={{ marginBottom: 12 }}>Reset password</h2>

      {!token ? <div style={{ marginBottom: 10, color: "crimson" }}>Missing token</div> : null}

      <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="New password"
          required
          style={{ padding: 10, borderRadius: 8, border: "1px solid #ddd" }}
        />
        <button
          type="submit"
          disabled={loading || !token}
          style={{ padding: 10, borderRadius: 8, border: "1px solid #ddd", cursor: "pointer" }}
        >
          {loading ? "Updating..." : "Update password"}
        </button>
      </form>

      {msg ? <div style={{ marginTop: 10, color: "green" }}>{msg}</div> : null}
      {err ? <div style={{ marginTop: 10, color: "crimson" }}>{err}</div> : null}

      <div style={{ marginTop: 12 }}>
        <Link to="/login">Back to login</Link>
      </div>
    </div>
  );
}
