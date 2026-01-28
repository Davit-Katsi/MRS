import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { setAuth } from "../auth/auth";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.post("/api/auth/login", { email, password });
      const { token, user } = res.data;

      setAuth({ token, role: user.role, user });
      navigate(user.role === "admin" ? "/admin" : "/supplier", { replace: true });
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "შესვლა ვერ მოხერხდა. შეამოწმეთ მონაცემები.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
  <div
    style={{
      minHeight: "80vh",
      display: "grid",
      placeItems: "center",
      padding: 16,
      background: "#ffffff",
    }}
  >
    <div style={{ width: "100%", maxWidth: 420 }}>
      {/* Logo OUTSIDE the box */}
      <div style={{ display: "grid", placeItems: "center", marginBottom: 14 }}>
        <img
          src="/logo.png"
          alt="MRS Logo"
          style={{
            width: 250,
            height: 250,
            objectFit: "contain",
          }}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      </div>

      {/* Login box */}
      <div
        style={{
          width: "100%",
          border: "1px solid #e5e5e5",
          borderRadius: 10,
          padding: 16,
          background: "#fff",
        }}
      >
        <h2 style={{ margin: 0, textAlign: "center" }}>ბაზრის კვლევის სისტემა</h2>
        <div
          style={{
            marginTop: 6,
            marginBottom: 14,
            textAlign: "center",
            fontSize: 12,
            opacity: 0.75,
          }}
        >
          ავტორიზაცია (Admin / Supplier)
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 13 }}>მომხმარებლის სახელი (Email)</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email"
              autoComplete="username"
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid #ccc",
                borderRadius: 6,
                boxSizing: "border-box",
              }}
              required
            />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 13 }}>პაროლი</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="პაროლი"
              type="password"
              autoComplete="current-password"
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid #ccc",
                borderRadius: 6,
                boxSizing: "border-box",
              }}
              required
            />
          </div>

          {error ? (
            <div
              style={{
                color: "crimson",
                border: "1px solid #f3b5b5",
                background: "#fff5f5",
                padding: "10px 12px",
                borderRadius: 8,
                fontSize: 13,
              }}
            >
              {error}
            </div>
          ) : null}

          <button
            disabled={loading}
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "1px solid #999",
              borderRadius: 6,
              cursor: loading ? "not-allowed" : "pointer",
              background: "#fff",
            }}
          >
            {loading ? "იტვირთება..." : "შესვლა"}
          </button>
        </form>
      </div>
    </div>
  </div>
);

}
