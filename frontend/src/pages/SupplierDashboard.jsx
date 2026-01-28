import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearAuth, getUser } from "../auth/auth";
import { api } from "../api/client";
import ExcelJS from "exceljs";

export default function SupplierDashboard() {
  const navigate = useNavigate();
  const user = getUser();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // single price form
  const [product_code, setProductCode] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("GEL");
  const [effective_date, setEffectiveDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [msg, setMsg] = useState("");

  // bulk excel upload
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkErr, setBulkErr] = useState("");
  const [bulkResult, setBulkResult] = useState(null);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  // --- UI styles (same as login/admin theme) ---
  const UI = {
    page: { padding: 16, background: "#fff", minHeight: "100vh" },
    container: { maxWidth: 1200, margin: "0 auto" },

    card: { border: "1px solid #e5e5e5", borderRadius: 10, padding: 16, background: "#fff" },

    input: {
      width: "100%",
      padding: "10px 12px",
      border: "1px solid #ccc",
      borderRadius: 6,
      boxSizing: "border-box",
      background: "#fff",
      fontSize: 13,
    },

    button: (disabled = false) => ({
      padding: "10px 12px",
      border: "1px solid #999",
      borderRadius: 6,
      cursor: disabled ? "not-allowed" : "pointer",
      background: "#fff",
      whiteSpace: "nowrap",
      fontSize: 13,
    }),

    buttonFull: (disabled = false) => ({
      width: "100%",
      padding: "10px 12px",
      border: "1px solid #999",
      borderRadius: 6,
      cursor: disabled ? "not-allowed" : "pointer",
      background: "#fff",
      fontSize: 13,
    }),

    muted: { fontSize: 12, opacity: 0.75 },
  };

  const assignedSet = useMemo(() => {
    return new Set(products.map((p) => String(p.product_code || "").trim()));
  }, [products]);

  const productsSorted = useMemo(() => {
    return [...products].sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  }, [products]);

  function logout() {
    clearAuth();
    navigate("/login", { replace: true });
  }

  async function loadMyProducts() {
    setErr("");
    setLoading(true);
    try {
      const res = await api.get("/api/supplier/products");
      setProducts(res.data.products || []);
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to load products");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMyProducts();
  }, []);

  async function submitPrice(e) {
    e.preventDefault();
    setErr("");
    setMsg("");

    try {
      const res = await api.post("/api/supplier/prices", {
        product_code,
        price,
        currency,
        effective_date,
      });

      setMsg(res.data?.message || "შენახულია");
      setPrice("");

      // refresh list so latest price appears
      await loadMyProducts();
    } catch (e2) {
      setErr(e2?.response?.data?.message || "Failed to submit price");
    }
  }

  function normHeader(v) {
    return String(v ?? "").trim().toLowerCase();
  }

  function excelSerialToISODate(serial) {
    const utcDays = Math.floor(Number(serial) - 25569);
    const utcValue = utcDays * 86400;
    const dateInfo = new Date(utcValue * 1000);
    return dateInfo.toISOString().slice(0, 10);
  }

  function cellToString(cellValue) {
    if (cellValue == null) return "";
    if (cellValue instanceof Date) return cellValue.toISOString().slice(0, 10);
    if (typeof cellValue === "number") return String(cellValue);
    if (typeof cellValue === "string") return cellValue;
    if (typeof cellValue === "object") {
      if (typeof cellValue.text === "string") return cellValue.text;
      if (typeof cellValue.result === "string" || typeof cellValue.result === "number") return String(cellValue.result);
    }
    return String(cellValue);
  }

  async function submitBulkPrices(e) {
    e.preventDefault();
    setBulkErr("");
    setBulkResult(null);

    if (!bulkFile) return setBulkErr("ატვირთეთ Excel ფაილი");

    setBulkLoading(true);
    setBulkProgress({ done: 0, total: 0 });

    try {
      const buf = await bulkFile.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buf);

      const worksheet = workbook.worksheets[0];
      if (!worksheet) throw new Error("Excel has no sheets");

      const headerRow = worksheet.getRow(1);
      const colIndex = {};

      headerRow.eachCell((cell, colNumber) => {
        const key = normHeader(cell.value);
        if (key) colIndex[key] = colNumber;
      });

      const required = ["product_code", "price"];
      for (const r of required) {
        if (!colIndex[r]) {
          throw new Error(`Missing required column: ${r} (headers must include: product_code, price)`);
        }
      }

      const rows = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;

        const product_code = String(cellToString(row.getCell(colIndex["product_code"])?.value)).trim();
        const priceVal = row.getCell(colIndex["price"])?.value;
        const price = String(cellToString(priceVal)).trim();

        const currencyVal = colIndex["currency"] ? row.getCell(colIndex["currency"])?.value : "GEL";
        const currency = String(cellToString(currencyVal) || "GEL").trim().toUpperCase();

        let effVal = colIndex["effective_date"] ? row.getCell(colIndex["effective_date"])?.value : "";
        let effective_date = "";

        if (effVal instanceof Date) effective_date = effVal.toISOString().slice(0, 10);
        else if (typeof effVal === "number") effective_date = excelSerialToISODate(effVal);
        else effective_date = String(cellToString(effVal)).trim();

        if (!effective_date) effective_date = new Date().toISOString().slice(0, 10);

        const looksEmpty = !product_code && !price && !currency && !effective_date;
        if (looksEmpty) return;

        rows.push({ product_code, price, currency, effective_date, _row: rowNumber });
      });

      const invalid = [];
      const ready = [];

      rows.forEach((r) => {
        if (!r.product_code || !r.price) {
          invalid.push({ row: r._row, reason: "Missing product_code or price", data: r });
          return;
        }
        if (assignedSet.size && !assignedSet.has(r.product_code)) {
          invalid.push({ row: r._row, reason: "Product not assigned to this supplier", data: r });
          return;
        }
        ready.push({
          product_code: r.product_code,
          price: r.price,
          currency: r.currency,
          effective_date: r.effective_date,
        });
      });

      setBulkProgress({ done: 0, total: ready.length });

      const ok = [];
      const failed = [];

      for (let i = 0; i < ready.length; i++) {
        const payload = ready[i];
        try {
          await api.post("/api/supplier/prices", payload);
          ok.push(payload);
        } catch (err2) {
          failed.push({
            payload,
            message: err2?.response?.data?.message || "Upload failed",
          });
        } finally {
          setBulkProgress((p) => ({ ...p, done: p.done + 1 }));
        }
      }

      setBulkResult({
        totalRowsInFile: rows.length,
        uploaded: ok.length,
        failed: failed.length,
        skipped: invalid.length,
        invalid,
        failedDetails: failed,
      });

      await loadMyProducts();
    } catch (err3) {
      setBulkErr(err3?.message || "Bulk upload failed");
    } finally {
      setBulkLoading(false);
    }
  }

  const format2 = (v) => {
    if (v === null || v === undefined || v === "") return "—";
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    return n.toFixed(2);
  };

  const cell = { padding: "8px 10px", borderBottom: "1px solid #eee", fontSize: 13 };
  const head = { padding: "8px 10px", borderBottom: "1px solid #ddd", fontSize: 13 };

  return (
    <div style={UI.page}>
      <div style={UI.container}>
        {/* Header: logo + system name + logout (same line). Email under system name */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img
              src="/logo2.png"
              alt="MRS Logo"
              style={{ width: 55, height: 55, objectFit: "contain" }}
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />

            <div>
              <div style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.2 }}>ბაზრის კვლევის სისტემა</div>
              <div style={UI.muted}>
                {user?.email} (მიმწოდებლის ID: {user?.supplierId})
              </div>
            </div>
          </div>

          <button onClick={logout} style={UI.button(false)}>
            გასვლა
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 }}>
          {/* LEFT: PRODUCTS */}
          <div style={UI.card}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>ნივთების სია</div>

              <button onClick={loadMyProducts} disabled={loading} style={UI.button(loading)}>
                {loading ? "იტვირთება..." : "განახლება"}
              </button>
            </div>

            {err ? <div style={{ color: "crimson", marginBottom: 10, fontSize: 13 }}>{err}</div> : null}

            <div style={{ maxHeight: 520, overflow: "auto", border: "1px solid #eee", borderRadius: 8 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f7f7f7", textAlign: "left" }}>
                    <th style={head}>კოდი</th>
                    <th style={head}>დასახელება</th>
                    <th style={head}>რაოდენობა</th>
                    <th style={head}>მიმდინარე ფასი</th>
                    <th style={head}>ბოლო განახლება</th>
                  </tr>
                </thead>

                <tbody>
                  {productsSorted.map((p) => {
                    const myPriceText =
                      p.latest_price != null && p.latest_price !== ""
                        ? `${format2(p.latest_price)} ${p.latest_currency || ""}`.trim()
                        : "—";

                    return (
                      <tr
                        key={p.productId}
                        style={{ cursor: "pointer" }}
                        onClick={() => setProductCode(p.product_code)}
                        title="არჩევა"
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
                      >
                        <td style={cell}>{p.product_code}</td>
                        <td style={cell}>{p.name}</td>
                        <td style={cell}>{p.unit}</td>
                        <td style={cell}>{myPriceText}</td>
                        <td style={cell}>{p.latest_effective_date ? String(p.latest_effective_date) : "—"}</td>
                      </tr>
                    );
                  })}

                  {!loading && productsSorted.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: 12, color: "#666", fontSize: 13 }}>
                        მინიჭებული ნივთები არ არსებობს
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          {/* RIGHT: SINGLE + BULK */}
          <div style={UI.card}>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 0, marginBottom: 12 }}>ღირებულების განახლება</div>

            <form onSubmit={submitPrice} style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ fontSize: 13 }}>კოდი (აირჩიეთ ნივთი მარცხენა სიიდან)</label>
                <input value={product_code} onChange={(e) => setProductCode(e.target.value)} required style={UI.input} />
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ fontSize: 13 }}>ფასი</label>
                <input value={price} onChange={(e) => setPrice(e.target.value)} required style={UI.input} />
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ fontSize: 13 }}>ვალუტა</label>
                <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={UI.input}>
                  <option value="GEL">ლარი</option>
                  <option value="USD">დოლარი</option>
                  <option value="EUR">ევრო</option>
                </select>
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ fontSize: 13 }}>ბოლო განახლება</label>
                <input type="date" value={effective_date} onChange={(e) => setEffectiveDate(e.target.value)} required style={UI.input} />
              </div>

              {msg ? <div style={{ color: "green", fontSize: 13 }}>{msg}</div> : null}
              {err ? <div style={{ color: "crimson", fontSize: 13 }}>{err}</div> : null}

              <button style={UI.buttonFull(false)}>შენახვა</button>
            </form>

            <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid #eee" }} />

            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 0, marginBottom: 8 }}>
              ფასების ცხრილის ატვირთვა (Excel-ის ფაილი)
            </div>

            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 10 }}>
              Excel-ის ცხრილი აუცილებლად უნდა შეიცავდეს შემდეგ ველები: <b>product_code</b>, <b>price</b>
            </div>

            <form onSubmit={submitBulkPrices} style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ fontSize: 13 }}>Excel-ის ფაილი (.xlsx)</label>

                <div
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #ccc",
                    borderRadius: 6,
                    boxSizing: "border-box",
                    background: "#fff",
                  }}
                >
                  <input
                    type="file"
                    accept=".xlsx"
                    onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
                    style={{ width: "100%", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              {bulkErr ? <div style={{ color: "crimson", fontSize: 13 }}>{bulkErr}</div> : null}

              <button disabled={bulkLoading} style={UI.buttonFull(bulkLoading)}>
                {bulkLoading ? `ატვირთვა ${bulkProgress.done}/${bulkProgress.total}...` : "ატვირთვა და შენახვა"}
              </button>
            </form>

            {bulkResult ? (
              <div
                style={{
                  marginTop: 12,
                  fontSize: 13,
                  padding: 10,
                  borderRadius: 8,
                  border: "1px solid #e5e5e5",
                  background: "#f7f7f7",
                }}
              >
                <b>აიტვირთა წარმატებით</b>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
