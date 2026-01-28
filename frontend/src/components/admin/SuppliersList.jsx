import React, { useEffect, useState } from "react";
import { api } from "../../api/client";

export default function SuppliersList({ onSelectSupplier, selectedSupplier }) {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const res = await api.get("/api/admin/suppliers");
      setSuppliers(res.data?.suppliers || []);
    } catch (e) {
      setErr(e?.response?.data?.message || "ვერ ჩაიტვირთა მომწოდებლები");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const cell = { padding: "8px 10px", borderBottom: "1px solid #eee", fontSize: 13 };
  const head = { padding: "8px 10px", borderBottom: "1px solid #ddd", fontSize: 13 };

  return (
    <div style={{ padding: 12, fontSize: 13 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
        }}
      >
        {/* Smaller title to match AdminDashboard */}
        <div style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>მომწოდებლები</div>

        <button
          onClick={load}
          disabled={loading}
          style={{
            padding: "10px 12px",
            border: "1px solid #999",
            borderRadius: 6,
            cursor: loading ? "not-allowed" : "pointer",
            background: "#fff",
            whiteSpace: "nowrap",
            fontSize: 13,
          }}
        >
          {loading ? "იტვირთება..." : "განახლება"}
        </button>
      </div>

      {err ? <div style={{ color: "crimson", marginTop: 6, fontSize: 13 }}>{err}</div> : null}

      <div style={{ border: "1px solid #e5e5e5", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f7f7f7", textAlign: "left" }}>
              <th style={{ ...head, width: 60 }}>ID</th>
              <th style={head}>მომწოდებლის სახელი</th>
              <th style={{ ...head, width: 110 }}>სტატუსი</th>
              <th style={{ ...head, width: 90 }}>User ID</th>
            </tr>
          </thead>

          <tbody>
            {suppliers.map((s) => {
              const isSelected = selectedSupplier?.id === s.id;

              return (
                <tr
                  key={s.id}
                  style={{
                    cursor: "pointer",
                    background: isSelected ? "#f3f3f3" : "#fff",
                  }}
                  onClick={() => onSelectSupplier?.(s)}
                  title="ნივთების ატვირთვისთვის აირჩიეთ"
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = "#fafafa";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = "#fff";
                  }}
                >
                  <td style={cell}>{s.id}</td>

                  <td style={cell}>
                    {s.company_name}
                    {isSelected ? (
                      <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.75 }}>(არჩეული)</span>
                    ) : null}
                  </td>

                  <td style={cell}>{s.active ? "აქტიური" : "პასიური"}</td>
                  <td style={cell}>{s.user_id}</td>
                </tr>
              );
            })}

            {!loading && suppliers.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: 12, color: "#666", fontSize: 13 }}>
                  მომწოდებელი არ არსებობს
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
