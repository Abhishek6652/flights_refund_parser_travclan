import { useState, useCallback } from "react";

const SUPPLIERS = [
  { id: "tripjack", label: "TripJack", files: ["sales_report"], fileLabels: ["Sales Report (CSV)"] },
  { id: "tbo", label: "TBO", files: ["sales_report", "ledger"], fileLabels: ["Sales Report (CSV)", "Ledger (CSV)"] },
  { id: "via", label: "VIA", files: ["refund_report"], fileLabels: ["Refund Report (CSV)"] },
  { id: "yatra", label: "Yatra", files: ["refund_report"], fileLabels: ["Refund Report (XLS)"] },
  { id: "emt", label: "EMT", files: ["refund_report"], fileLabels: ["Refund Report (XLS)"] },
  { id: "akbar", label: "Akbar", files: ["sales_report"], fileLabels: ["Sales Report (XLSX)"] },
];

// -- Update this to your deployed Cloud Run URL for production --
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8090";

const STATUS = { idle: "idle", loading: "loading", success: "success", error: "error" };

export default function ReportParser() {
  const [supplier, setSupplier] = useState(null);
  const [files, setFiles] = useState({});
  const [status, setStatus] = useState(STATUS.idle);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");

  const selectedSupplier = SUPPLIERS.find((s) => s.id === supplier);

  const handleFileChange = useCallback((fieldName, e) => {
    const file = e.target.files?.[0];
    if (file) {
      setFiles((prev) => ({ ...prev, [fieldName]: file }));
    }
  }, []);

  const handleParse = useCallback(async () => {
    if (!supplier) return;
    const sup = SUPPLIERS.find((s) => s.id === supplier);
    const allFilesReady = sup.files.every((f) => files[f]);
    if (!allFilesReady) return;

    setStatus(STATUS.loading);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("supplier", supplier);

    if (supplier === "tbo") {
      formData.append("sales_report", files["sales_report"]);
      formData.append("ledger", files["ledger"]);
    } else {
      const fileKey = sup.files[0];
      formData.append("file", files[fileKey]);
    }

    try {
      const res = await fetch(`${API_BASE}/parse`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setStatus(STATUS.error);
        setError(data.error || data.detail || "Parse failed");
        return;
      }
      setResult(data);
      setStatus(STATUS.success);
    } catch (err) {
      setStatus(STATUS.error);
      setError(err.message || "Network error");
    }
  }, [supplier, files]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const filteredRows = (result?.rows || [])
    .filter((r) => {
      if (!searchTerm) return true;
      const s = searchTerm.toLowerCase();
      return (
        (r.pnr || "").toLowerCase().includes(s) ||
        (r.booking_id || "").toLowerCase().includes(s)
      );
    })
    .sort((a, b) => {
      if (!sortKey) return 0;
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });

  const totalAmtRcvd = filteredRows.reduce((s, r) => s + (r.amount_received_supplier || 0), 0);
  const totalAirline = filteredRows.reduce((s, r) => s + (r.airline_cancellation_charge || 0), 0);
  const totalSupplier = filteredRows.reduce((s, r) => s + (r.supplier_charge || 0), 0);

  const fmt = (n) => {
    if (n === null || n === undefined) return "—";
    return "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const SortIcon = ({ col }) => {
    if (sortKey !== col) return <span className="text-gray-400 ml-1">↕</span>;
    return <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
        fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif",
        color: "#e2e8f0",
        padding: "24px",
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
        rel="stylesheet"
      />

      {/* Header */}
      <div style={{ maxWidth: 1100, margin: "0 auto 32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              fontWeight: 700,
            }}
          >
            ⚡
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>
            Report Parser
          </h1>
          <span
            style={{
              fontSize: 11,
              background: "#1e3a5f",
              color: "#60a5fa",
              padding: "2px 8px",
              borderRadius: 4,
              fontWeight: 500,
            }}
          >
            TEST
          </span>
        </div>
        <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>
          Upload supplier reports → validate parsed Airline Charges + Amount Received
        </p>
      </div>

      {/* Upload Card */}
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto 24px",
          background: "#1e293b",
          border: "1px solid #334155",
          borderRadius: 12,
          padding: 28,
        }}
      >
        {/* Supplier Selection */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Select Supplier
          </label>
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            {SUPPLIERS.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setSupplier(s.id);
                  setFiles({});
                  setResult(null);
                  setStatus(STATUS.idle);
                }}
                style={{
                  padding: "8px 18px",
                  borderRadius: 8,
                  border: supplier === s.id ? "2px solid #3b82f6" : "1px solid #475569",
                  background: supplier === s.id ? "#1e3a5f" : "transparent",
                  color: supplier === s.id ? "#60a5fa" : "#cbd5e1",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* File Upload Fields */}
        {selectedSupplier && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {selectedSupplier.files.map((fieldName, idx) => (
                <div
                  key={fieldName}
                  style={{
                    flex: "1 1 280px",
                    border: files[fieldName] ? "1px solid #22c55e" : "1px dashed #475569",
                    borderRadius: 10,
                    padding: 16,
                    background: files[fieldName] ? "#0f2918" : "#0f172a",
                    position: "relative",
                    transition: "all 0.2s",
                  }}
                >
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {selectedSupplier.fileLabels[idx]}
                  </label>
                  <input
                    type="file"
                    accept=".csv,.xls,.xlsx"
                    onChange={(e) => handleFileChange(fieldName, e)}
                    style={{
                      display: "block",
                      marginTop: 8,
                      fontSize: 12,
                      color: "#cbd5e1",
                      width: "100%",
                    }}
                  />
                  {files[fieldName] && (
                    <div style={{ marginTop: 8, fontSize: 12, color: "#4ade80", display: "flex", alignItems: "center", gap: 4 }}>
                      ✓ {files[fieldName].name}
                      <span style={{ color: "#64748b", marginLeft: 4 }}>
                        ({(files[fieldName].size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Parse Button */}
        {selectedSupplier && (
          <button
            onClick={handleParse}
            disabled={
              status === STATUS.loading ||
              !selectedSupplier.files.every((f) => files[f])
            }
            style={{
              padding: "10px 28px",
              borderRadius: 8,
              border: "none",
              background:
                status === STATUS.loading || !selectedSupplier.files.every((f) => files[f])
                  ? "#334155"
                  : "linear-gradient(135deg, #3b82f6, #6366f1)",
              color:
                status === STATUS.loading || !selectedSupplier.files.every((f) => files[f])
                  ? "#64748b"
                  : "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor:
                status === STATUS.loading || !selectedSupplier.files.every((f) => files[f])
                  ? "not-allowed"
                  : "pointer",
              transition: "all 0.15s",
            }}
          >
            {status === STATUS.loading ? "Parsing..." : "Parse Report"}
          </button>
        )}
      </div>

      {/* Error */}
      {status === STATUS.error && (
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto 24px",
            background: "#2d1215",
            border: "1px solid #7f1d1d",
            borderRadius: 10,
            padding: 16,
            fontSize: 13,
            color: "#fca5a5",
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Results */}
      {result && status === STATUS.success && (
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          {/* Summary Bar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "16px 24px",
              borderBottom: "1px solid #334155",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>ROWS</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>
                  {filteredRows.length}
                  {searchTerm && (
                    <span style={{ fontSize: 12, color: "#64748b", fontWeight: 400 }}>
                      {" "}/ {result.rows_parsed}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>TOTAL AMT RECEIVED</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#4ade80" }}>{fmt(totalAmtRcvd)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>TOTAL AIRLINE CHG</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#f97316" }}>{fmt(totalAirline)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>TOTAL SUPPLIER CHG</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#a78bfa" }}>{fmt(totalSupplier)}</div>
              </div>
            </div>

            {/* Search */}
            <div style={{ position: "relative" }}>
              <input
                type="text"
                placeholder="Search PNR / Booking ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  padding: "8px 12px 8px 32px",
                  borderRadius: 8,
                  border: "1px solid #475569",
                  background: "#0f172a",
                  color: "#e2e8f0",
                  fontSize: 13,
                  width: 220,
                  outline: "none",
                }}
              />
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#64748b", fontSize: 14 }}>
                🔍
              </span>
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 13,
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              <thead>
                <tr style={{ background: "#0f172a" }}>
                  {[
                    { key: "idx", label: "#", width: 45 },
                    { key: "pnr", label: "PNR", width: 120 },
                    { key: "booking_id", label: "Booking ID", width: 160 },
                    { key: "amount_received_supplier", label: "Amt Received from Supplier", width: 200 },
                    { key: "airline_cancellation_charge", label: "Airline Cancellation Charge", width: 200 },
                    { key: "supplier_charge", label: "Supplier Charge", width: 140 },
                    { key: "pax_count", label: "Pax", width: 60 },
                  ].map((col) => (
                    <th
                      key={col.key}
                      onClick={() => col.key !== "idx" && handleSort(col.key)}
                      style={{
                        padding: "10px 14px",
                        textAlign: col.key === "idx" ? "center" : "right",
                        color: "#94a3b8",
                        fontWeight: 600,
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        cursor: col.key !== "idx" ? "pointer" : "default",
                        borderBottom: "1px solid #334155",
                        whiteSpace: "nowrap",
                        minWidth: col.width,
                        userSelect: "none",
                      }}
                    >
                      {col.key === "pnr" || col.key === "booking_id" ? (
                        <span style={{ textAlign: "left", display: "block" }}>
                          {col.label}
                          {col.key !== "idx" && <SortIcon col={col.key} />}
                        </span>
                      ) : (
                        <>
                          {col.label}
                          {col.key !== "idx" && <SortIcon col={col.key} />}
                        </>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, i) => (
                  <tr
                    key={i}
                    style={{
                      background: i % 2 === 0 ? "transparent" : "rgba(15,23,42,0.4)",
                      borderBottom: "1px solid #1e293b",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(59,130,246,0.08)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? "transparent" : "rgba(15,23,42,0.4)")}
                  >
                    <td style={{ padding: "8px 14px", textAlign: "center", color: "#64748b", fontSize: 11 }}>
                      {i + 1}
                    </td>
                    <td style={{ padding: "8px 14px", textAlign: "left", color: "#60a5fa", fontWeight: 600 }}>
                      {row.pnr || "—"}
                    </td>
                    <td style={{ padding: "8px 14px", textAlign: "left", color: "#94a3b8", fontSize: 11 }}>
                      {row.booking_id || row.tj_via_code || row.emt_code || "—"}
                    </td>
                    <td style={{ padding: "8px 14px", textAlign: "right", color: "#4ade80", fontWeight: 500 }}>
                      {fmt(row.amount_received_supplier)}
                    </td>
                    <td style={{ padding: "8px 14px", textAlign: "right", color: "#f97316", fontWeight: 500 }}>
                      {fmt(row.airline_cancellation_charge)}
                    </td>
                    <td style={{ padding: "8px 14px", textAlign: "right", color: "#a78bfa" }}>
                      {fmt(row.supplier_charge)}
                    </td>
                    <td style={{ padding: "8px 14px", textAlign: "right", color: "#94a3b8" }}>
                      {row.pax_count || "—"}
                    </td>
                  </tr>
                ))}
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
                      {searchTerm ? "No matching rows" : "No data"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
