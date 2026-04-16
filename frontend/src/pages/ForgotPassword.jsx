import React, { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    setLoading(true);
    try {
      const res = await api.post("/api/auth/request-reset", { email });
      setMsg(res.data?.message || "If the email exists, a reset link will be generated.");
    } catch (e2) {
      setErr(e2?.response?.data?.message || "Server error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "60px auto", padding: 16 }}>
      <h2 style={{ marginBottom: 12 }}>Forgot password</h2>

      <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          style={{ padding: 10, borderRadius: 8, border: "1px solid #ddd" }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{ padding: 10, borderRadius: 8, border: "1px solid #ddd", cursor: "pointer" }}
        >
          {loading ? "Sending..." : "Send reset link"}
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
