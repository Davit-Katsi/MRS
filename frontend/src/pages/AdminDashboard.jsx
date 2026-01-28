import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearAuth, getUser } from "../auth/auth";
import { api } from "../api/client";
import { downloadWithAuth, downloadPostWithAuth } from "../utils/download";
import SuppliersList from "../components/admin/SuppliersList";

/** Login-page-like theme (white + light gray) */
const UI = {
  page: {
    minHeight: "100vh",
    background: "#fff",
    padding: 16,
  },
  container: {
    width: "100%",
    maxWidth: 1100,
    margin: "0 auto",
  },
  card: {
    border: "1px solid #e5e5e5",
    borderRadius: 10,
    padding: 16,
    background: "#fff",
  },
  title: { margin: 0 },
  muted: { fontSize: 12, opacity: 0.75 },

  input: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #ccc",
    borderRadius: 6,
    boxSizing: "border-box",
    background: "#fff",
  },

  button: (disabled = false) => ({
    padding: "10px 12px",
    border: "1px solid #999",
    borderRadius: 6,
    cursor: disabled ? "not-allowed" : "pointer",
    background: "#fff",
    whiteSpace: "nowrap",
  }),

  buttonFull: (disabled = false) => ({
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #999",
    borderRadius: 6,
    cursor: disabled ? "not-allowed" : "pointer",
    background: "#fff",
  }),

  msgBox: (type) => ({
    color: type === "error" ? "crimson" : "green",
    border: "1px solid #e5e5e5",
    background: type === "error" ? "#fff5f5" : "#f6fff6",
    padding: "10px 12px",
    borderRadius: 8,
    fontSize: 13,
  }),
};

const format2 = (v) => {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(2);
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const user = getUser();

  const [activeTab, setActiveTab] = useState("suppliers");
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  function logout() {
    clearAuth();
    navigate("/login", { replace: true });
  }

  return (
    <div style={UI.page}>
      <div style={UI.container}>
        {/* Top header row: logo + title (left) | logout (right) */}
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
              <div style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.2 }}>
                ბაზრის კვლევის სისტემა
              </div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>{user?.email}</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: 16,
          }}
        >
          {/* Tabs (left) */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Tab
              label="მომწოდებლები"
              active={activeTab === "suppliers"}
              onClick={() => setActiveTab("suppliers")}
            />
            <Tab
              label="ნივთების ატვირთვა"
              active={activeTab === "import"}
              onClick={() => setActiveTab("import")}
            />
            <Tab
              label="ნივთების ძებნა"
              active={activeTab === "report"}
              onClick={() => setActiveTab("report")}
            />
          </div>

          {/* Logout (right) */}
          <button onClick={logout} style={UI.button(false)}>
            გამოსვლა
          </button>
        </div>

        {activeTab === "suppliers" && (
          <SuppliersPanel
            selectedSupplier={selectedSupplier}
            onPickSupplier={(s) => {
              setSelectedSupplier(s);
              setActiveTab("import");
            }}
          />
        )}

        {activeTab === "import" && (
          <ImportProductsPanel selectedSupplier={selectedSupplier} />
        )}

        {activeTab === "report" && <ReportPanel />}
      </div>
    </div>
  );
}

function Tab({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "10px 14px",
        border: "1px solid #ddd",
        borderRadius: 8,
        background: active ? "#f3f3f3" : "#fff",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

function Panel({ title, children }) {
  return (
    <div style={UI.card}>
      {title ? (
        <h3 style={{ marginTop: 0, marginBottom: 12 }}>{title}</h3>
      ) : null}
      {children}
    </div>
  );
}

/** TAB 1: Create Supplier + List */
function SuppliersPanel({ onPickSupplier, selectedSupplier }) {
  const [company_name, setCompany] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [created, setCreated] = useState(null);

  async function createSupplier(e) {
    e.preventDefault();
    setMsg("");
    setErr("");
    setCreated(null);
    setLoading(true);

    try {
      const res = await api.post("/api/admin/suppliers", {
        company_name,
        name,
        email,
        password,
      });
      setCreated(res.data);
      setMsg(res.data?.message || "მომწოდებელი წარმატებით შეიქმნა");
      setCompany("");
      setName("");
      setEmail("");
      setPassword("");
    } catch (e2) {
      setErr(e2?.response?.data?.message || "მომწოდებელი არ დაემატა");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Panel title="მომწოდებლის დამატება">
        <form
          onSubmit={createSupplier}
          style={{ display: "grid", gap: 10, maxWidth: 420 }}
        >
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 13 }}>მომწოდებლის სახელი</label>
            <input
              value={company_name}
              onChange={(e) => setCompany(e.target.value)}
              required
              style={UI.input}
            />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 13 }}>საკონტაქტო პირი</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={UI.input}
            />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 13 }}>
              მომხმარებლის სახელი (Email)
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={UI.input}
            />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 13 }}>პაროლი</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              style={UI.input}
            />
          </div>

          {err ? <div style={UI.msgBox("error")}>{err}</div> : null}
          {msg ? <div style={UI.msgBox("ok")}>{msg}</div> : null}

          <button disabled={loading} style={UI.buttonFull(loading)}>
            {loading ? "იტვირთება..." : "დამატება"}
          </button>
        </form>

        {created?.supplier?.id ? (
          <div style={{ marginTop: 12, fontSize: 13 }}>
            <b>Created Supplier ID:</b> {created.supplier.id}
            <div style={{ opacity: 0.8 }}>
              Use this ID in “Import Products” tab.
            </div>
          </div>
        ) : null}
      </Panel>

      <Panel title="მომწოდებლების სია">
        {selectedSupplier ? (
          <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 10 }}>
            არჩეული: <b>{selectedSupplier.company_name}</b> (ID:{" "}
            {selectedSupplier.id})
          </div>
        ) : null}

        <SuppliersList
          onSelectSupplier={onPickSupplier}
          selectedSupplier={selectedSupplier}
        />
      </Panel>
    </div>
  );
}

/** TAB 2: Import Products (Excel) */
function ImportProductsPanel({ selectedSupplier }) {
  const [supplierId, setSupplierId] = useState("");
  const [file, setFile] = useState(null);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (selectedSupplier?.id) setSupplierId(String(selectedSupplier.id));
  }, [selectedSupplier]);

  async function upload(e) {
    e.preventDefault();
    setErr("");
    setResult(null);

    if (!supplierId) return setErr("შეიყვანეთ მომწოდებლის ID");
    if (!file) return setErr("აირჩიეთ Excel-ის ფაილი");

    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);

      const res = await api.post(
        `/api/admin/suppliers/${supplierId}/products/import`,
        form,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      setResult(res.data);
    } catch (e2) {
      setErr(e2?.response?.data?.message || "ვერ აიტვირთა");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Panel title="ნივთების სიის ატვირთვა (Excel-ის ფაილი)">
      {selectedSupplier ? (
        <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 10 }}>
          არჩეული: <b>{selectedSupplier.company_name}</b> (ID:{" "}
          {selectedSupplier.id})
        </div>
      ) : null}

      <form
        onSubmit={upload}
        style={{ display: "grid", gap: 10, maxWidth: 520 }}
      >
        <div style={{ display: "grid", gap: 6 }}>
          <label style={{ fontSize: 13 }}>მომწოდებლის ID</label>
          <input
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            placeholder="მაგ. 1"
            style={UI.input}
          />
        </div>

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
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              style={{ width: "100%" }}
            />
          </div>
        </div>

        {err ? <div style={UI.msgBox("error")}>{err}</div> : null}

        <button disabled={loading} style={UI.buttonFull(loading)}>
          {loading ? "იტვირთება..." : "ატვირთვა"}
        </button>
      </form>

      {result ? (
        <div style={{ marginTop: 12, fontSize: 13 }}>
          <b>{result.message}</b>
          <pre
            style={{
              background: "#f7f7f7",
              padding: 10,
              borderRadius: 8,
              overflow: "auto",
            }}
          >
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      ) : null}
    </Panel>
  );
}

/** TAB 3: Product Report + Exports + BULK */
function ReportPanel() {
  // ---- existing single product report states ----
  const [productCode, setProductCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  // ---- bulk states ----
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkMinSuppliers, setBulkMinSuppliers] = useState(3);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkErr, setBulkErr] = useState("");
  const [bulkData, setBulkData] = useState(null);

  // ✅ NEW: voucher states
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [voucherErr, setVoucherErr] = useState("");
  const [voucherMsg, setVoucherMsg] = useState("");

  // bulk table styling (matching clean SuppliersList look)
  const cell = {
    padding: "8px 10px",
    borderBottom: "1px solid #eee",
    fontSize: 13,
    verticalAlign: "top",
  };
  const head = {
    padding: "8px 10px",
    borderBottom: "1px solid #ddd",
    fontSize: 13,
    verticalAlign: "top",
  };
  const tableWrapper = {
    border: "1px solid #e5e5e5",
    borderRadius: 10,
    overflow: "hidden",
    background: "#fff",
  };

  async function loadReport(e) {
    e.preventDefault();
    setErr("");
    setData(null);
    if (!productCode) return setErr("საჭიროა კოდი");

    setLoading(true);
    try {
      const res = await api.get(`/api/reports/product/${productCode}`);
      setData(res.data);
    } catch (e2) {
      setErr(e2?.response?.data?.message || "ვერ მოიძებნა");
    } finally {
      setLoading(false);
    }
  }

  async function uploadBulk(e) {
    e.preventDefault();
    setBulkErr("");
    setBulkData(null);
    setVoucherErr("");
    setVoucherMsg("");

    if (!bulkFile) return setBulkErr("აირჩიეთ Excel-ის ფაილი (.xlsx)");

    setBulkLoading(true);
    try {
      const form = new FormData();
      form.append("file", bulkFile);
      form.append("minSuppliers", String(bulkMinSuppliers || 3));

      const res = await api.post(`/api/reports/bulk/lowest`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setBulkData(res.data);
    } catch (e2) {
      setBulkErr(e2?.response?.data?.message || "ვერ აიტვირთა / ვერ დამუშავდა");
    } finally {
      setBulkLoading(false);
    }
  }

  const top3 = (row) => {
    const arr = Array.isArray(row?.topSuppliers) ? row.topSuppliers : [];
    return [arr[0] || null, arr[1] || null, arr[2] || null];
  };

  // ✅ NEW: try read JSON error from blob
  async function readBlobErrorMessage(e2) {
    try {
      const blob = e2?.response?.data;
      const ct =
        e2?.response?.headers?.["content-type"] ||
        e2?.response?.headers?.["Content-Type"] ||
        "";
      if (blob && typeof blob.text === "function" && String(ct).includes("application/json")) {
        const txt = await blob.text();
        const j = JSON.parse(txt);
        return j?.message || txt;
      }
    } catch (err) {
        void err;
      }

    return e2?.response?.data?.message || e2?.message || "ვერ დამუშავდა";
  }

  // ✅ NEW: generate voucher ZIP (PDF per row, lowest price only)
  async function generateVouchersZip() {
    setVoucherErr("");
    setVoucherMsg("");

    if (!bulkFile) {
      setVoucherErr("ვაუჩერის გენერაციისთვის ატვირთეთ Excel ფაილი");
      return;
    }

    setVoucherLoading(true);
    try {
      const form = new FormData();
      form.append("file", bulkFile);

      await downloadPostWithAuth(
        `/api/reports/bulk/vouchers/pdf-zip`,
        form,
        `vouchers.zip`
      );

      setVoucherMsg("ვაუჩერების ZIP წარმატებით ჩამოიტვირთა");
    } catch (e2) {
      const msg = await readBlobErrorMessage(e2);
      setVoucherErr(msg);
    } finally {
      setVoucherLoading(false);
    }
  }

  return (
    <Panel title="ნივთების ძიება და ჩამოტვირთვა">
      {/* ---------------- SINGLE PRODUCT REPORT (existing) ---------------- */}
      <form
        onSubmit={loadReport}
        style={{ display: "grid", gap: 10, maxWidth: 720, marginBottom: 12 }}
      >
        <div style={{ display: "grid", gap: 6 }}>
          <label style={{ fontSize: 13 }}>კოდი</label>
          <input
            value={productCode}
            onChange={(e) => setProductCode(e.target.value)}
            style={UI.input}
            placeholder="მაგ. 5478"
          />
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button disabled={loading} style={UI.button(loading)}>
            {loading ? "იტვირთება..." : "ძებნა"}
          </button>

          <button
            type="button"
            style={UI.button(!productCode)}
            onClick={() =>
              downloadWithAuth(
                `/api/reports/product/${productCode}/export/csv`,
                `report_${productCode}.csv`
              )
            }
            disabled={!productCode}
          >
            CSV ჩამოტვირთვა
          </button>

          <button
            type="button"
            style={UI.button(!productCode)}
            onClick={() =>
              downloadWithAuth(
                `/api/reports/product/${productCode}/export/excel`,
                `report_${productCode}.xlsx`
              )
            }
            disabled={!productCode}
          >
            Excel ჩამოტვირთვა
          </button>

          <button
            type="button"
            style={UI.button(!productCode)}
            onClick={() =>
              downloadWithAuth(
                `/api/reports/product/${productCode}/export/pdf`,
                `report_${productCode}.pdf`
              )
            }
            disabled={!productCode}
          >
            PDF ჩამოტვირთვა
          </button>
        </div>
      </form>

      {err ? <div style={UI.msgBox("error")}>{err}</div> : null}

      {data ? (
        <div style={UI.card}>
          <div style={{ marginBottom: 10 }}>
            <b>{data.product.product_code}</b> — {data.product.name}
          </div>

          <div style={{ marginBottom: 10, fontSize: 13, opacity: 0.85 }}>
            მომწოდებლები: {data.summary.supplierCount} | მინ:{" "}
            {format2(data.summary.minPrice)} | მაქს:{" "}
            {format2(data.summary.maxPrice)}
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f7f7f7", textAlign: "left" }}>
                  <th style={{ padding: 10, borderBottom: "1px solid #ddd" }}>
                    მომწოდებელი
                  </th>
                  <th style={{ padding: 10, borderBottom: "1px solid #ddd" }}>
                    ფასი
                  </th>
                  <th style={{ padding: 10, borderBottom: "1px solid #ddd" }}>
                    ვალუტა
                  </th>
                  <th style={{ padding: 10, borderBottom: "1px solid #ddd" }}>
                    განხლების თარიღი
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.latestPrices.map((r, idx) => (
                  <tr key={idx} style={{ borderTop: "1px solid #eee" }}>
                    <td style={{ padding: 10 }}>{r.supplierName}</td>
                    <td style={{ padding: 10 }}>{format2(r.price)}</td>
                    <td style={{ padding: 10 }}>{r.currency}</td>
                    <td style={{ padding: 10 }}>
                      {r.effective_date ? String(r.effective_date) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ border: "1px dashed #ccc", padding: 12, borderRadius: 8 }}>
          ინდივიდუალური ნივთის მოძებნა, კოდით (მაგ. 5478)
        </div>
      )}

      {/* ---------------- BULK REPORT ---------------- */}
      <div style={{ marginTop: 18 }}>
        <div style={{ height: 1, background: "#eee", margin: "18px 0" }} />

        <h4 style={{ margin: "0 0 8px 0" }}>
          რამდენიმე ნივთის ფასების მოძებნა ერთდროულად (Excel)
        </h4>
        <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 10 }}>
          ატვირთეთ Excel (.xlsx), სადაც არის პროდუქტის კოდები (სასურველია სვეტის
          სახელი: <b>product_code</b> ან <b>კოდი</b>).
          <div style={{ marginTop: 6 }}>
            ვაუჩერებისთვის Excel-ში სავალდებულოა დამატებით სვეტები:{" "}
            <b>beneficiary_name</b> და <b>beneficiary_id</b>.
          </div>
        </div>

        <form
          onSubmit={uploadBulk}
          style={{ display: "grid", gap: 10, maxWidth: 720 }}
        >
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
                style={{ width: "100%" }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gap: 6, maxWidth: 220 }}>
            <label style={{ fontSize: 13 }}>რამდენი მინ. მომწოდებელი</label>
            <input
              type="number"
              min={1}
              value={bulkMinSuppliers}
              onChange={(e) => setBulkMinSuppliers(Number(e.target.value || 3))}
              style={UI.input}
            />
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button disabled={bulkLoading} style={UI.button(bulkLoading)}>
              {bulkLoading ? "იტვირთება..." : "ატვირთვა და ძებნა"}
            </button>

            <button
              type="button"
              style={UI.button(false)}
              onClick={() => {
                setBulkFile(null);
                setBulkErr("");
                setBulkData(null);
                setVoucherErr("");
                setVoucherMsg("");
              }}
            >
              გასუფთავება
            </button>
          </div>

          {bulkErr ? <div style={UI.msgBox("error")}>{bulkErr}</div> : null}
        </form>

        {bulkData ? (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 10 }}>
              მოთხოვნილი კოდები: <b>{bulkData.requestedCount}</b> | მინ. მომწოდებელი:{" "}
              <b>{bulkData.minSuppliers}</b>
              {Array.isArray(bulkData.notFound) && bulkData.notFound.length ? (
                <>
                  {" "}
                  | ვერ მოიძებნა: <b>{bulkData.notFound.length}</b>
                </>
              ) : null}
              {Array.isArray(bulkData.insufficientSuppliers) &&
              bulkData.insufficientSuppliers.length ? (
                <>
                  {" "}
                  | ნაკლები მომწოდებელი: <b>{bulkData.insufficientSuppliers.length}</b>
                </>
              ) : null}
            </div>

            {/* ✅ Bulk export buttons + Vouchers ZIP */}
            {(() => {
              const bulkCodes = (bulkData?.results || [])
                .map((r) => r?.productCode)
                .filter(Boolean)
                .join(",");

              return (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                  <button
                    type="button"
                    style={UI.button(!bulkCodes)}
                    disabled={!bulkCodes}
                    onClick={() =>
                      downloadWithAuth(
                        `/api/reports/bulk/lowest/export/csv?codes=${encodeURIComponent(
                          bulkCodes
                        )}&minSuppliers=${encodeURIComponent(String(bulkMinSuppliers || 3))}`,
                        `bulk_lowest_prices.csv`
                      )
                    }
                  >
                    CSV ჩამოტვირთვა
                  </button>

                  <button
                    type="button"
                    style={UI.button(!bulkCodes)}
                    disabled={!bulkCodes}
                    onClick={() =>
                      downloadWithAuth(
                        `/api/reports/bulk/lowest/export/excel?codes=${encodeURIComponent(
                          bulkCodes
                        )}&minSuppliers=${encodeURIComponent(String(bulkMinSuppliers || 3))}`,
                        `bulk_lowest_prices.xlsx`
                      )
                    }
                  >
                    Excel ჩამოტვირთვა
                  </button>

                  <button
                    type="button"
                    style={UI.button(!bulkCodes)}
                    disabled={!bulkCodes}
                    onClick={() =>
                      downloadWithAuth(
                        `/api/reports/bulk/lowest/export/pdf?codes=${encodeURIComponent(
                          bulkCodes
                        )}&minSuppliers=${encodeURIComponent(String(bulkMinSuppliers || 3))}`,
                        `bulk_lowest_prices.pdf`
                      )
                    }
                  >
                    PDF ჩამოტვირთვა
                  </button>

                  {/* ✅ NEW: Vouchers ZIP (lowest price only) */}
                  <button
                    type="button"
                    style={UI.button(voucherLoading || !bulkFile)}
                    disabled={voucherLoading || !bulkFile}
                    onClick={generateVouchersZip}
                    title="ვაუჩერებისთვის საჭიროა beneficiary_name და beneficiary_id"
                  >
                    {voucherLoading ? "ვაუჩერები..." : "ვაუჩერების ZIP (PDF)"}
                  </button>
                </div>
              );
            })()}

            {voucherErr ? <div style={UI.msgBox("error")}>{voucherErr}</div> : null}
            {voucherMsg ? <div style={UI.msgBox("ok")}>{voucherMsg}</div> : null}

            {/* ✅ Redesigned table (fonts + header like SuppliersList) */}
            <div style={{ overflowX: "auto" }}>
              <div style={tableWrapper}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f7f7f7", textAlign: "left" }}>
                      <th style={{ ...head, width: 90 }}>კოდი</th>
                      <th style={{ ...head, minWidth: 220 }}>დასახელება</th>

                      <th style={{ ...head, minWidth: 180 }}>მომწოდებელი #1</th>
                      <th style={{ ...head, width: 120 }}>ფასი #1</th>

                      <th style={{ ...head, minWidth: 180 }}>მომწოდებელი #2</th>
                      <th style={{ ...head, width: 120 }}>ფასი #2</th>

                      <th style={{ ...head, minWidth: 180 }}>მომწოდებელი #3</th>
                      <th style={{ ...head, width: 120 }}>ფასი #3</th>

                      <th style={{ ...head, width: 150 }}>მომწოდებლები (სულ)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(bulkData.results || []).map((row, idx) => {
                      const [s1, s2, s3] = top3(row);
                      const name =
                        row?.product?.name || (row.found ? "—" : "ვერ მოიძებნა");

                      return (
                        <tr key={idx}>
                          <td style={cell}>{row.productCode}</td>
                          <td style={cell}>{name}</td>

                          <td style={cell}>{s1?.supplierName || "—"}</td>
                          <td style={cell}>
                            {s1 ? `${format2(s1.price)} ${s1.currency || ""}` : "—"}
                          </td>

                          <td style={cell}>{s2?.supplierName || "—"}</td>
                          <td style={cell}>
                            {s2 ? `${format2(s2.price)} ${s2.currency || ""}` : "—"}
                          </td>

                          <td style={cell}>{s3?.supplierName || "—"}</td>
                          <td style={cell}>
                            {s3 ? `${format2(s3.price)} ${s3.currency || ""}` : "—"}
                          </td>

                          <td style={cell}>{row.supplierCount ?? 0}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
