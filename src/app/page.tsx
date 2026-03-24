"use client";

import { useState, useCallback, useEffect } from "react";

type TabId = "gold" | "fuel" | "exchange" | "telegram" | "api";

interface GoldPrice { buyingPrice: number; sellingPrice: number; code: string; sellChange: number; sellChangePercent: number; buyChange: number; buyChangePercent: number; dateTime: string; }
interface GoldData { prices: GoldPrice[]; crawledAt: string; crawledAtMs: number; source: string; }
interface FuelPrice { index: number; product: string; price: number; priceText: string; change: number; unit: string; }
interface FuelData { prices: FuelPrice[]; priceDate: string; crawledAt: string; crawledAtMs: number; source: string; }
interface ExchangeRate { code: string; name: string; buyCash: string; buyTransfer: string; sell: string; }
interface ExchangeData { rates: ExchangeRate[]; crawledAt: string; crawledAtMs: number; source: string; }

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("gold");
  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: "gold", label: "Giá Vàng", icon: "💰" },
    { id: "fuel", label: "Giá Xăng", icon: "⛽" },
    { id: "exchange", label: "Tỷ Giá", icon: "💱" },
    { id: "telegram", label: "Telegram", icon: "🤖" },
    { id: "api", label: "API", icon: "📡" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "fixed", top: "-20%", left: "-10%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, #6366f108, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: "-20%", right: "-10%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, #8b5cf608, transparent 70%)", pointerEvents: "none" }} />

      <header style={{ borderBottom: "1px solid var(--border-color)", padding: "20px 0", position: "relative", zIndex: 10, backdropFilter: "blur(20px)", background: "#0a0a0f99" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--accent-gradient)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem", boxShadow: "var(--glow-primary)" }}>🌐</div>
            <div>
              <h1 style={{ fontSize: "1.3rem", fontWeight: 700, background: "var(--accent-gradient)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>InfoHub</h1>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>Giá Vàng • Giá Xăng • Tỷ Giá • Bot</p>
            </div>
          </div>
          <div className="status-badge active" style={{ animation: "pulse-glow 2s ease-in-out infinite" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)", display: "inline-block" }} />Online
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px", position: "relative", zIndex: 10 }}>
        <nav style={{ display: "flex", gap: 4, background: "var(--bg-secondary)", borderRadius: 14, padding: 4, marginBottom: 32, border: "1px solid var(--border-color)", overflowX: "auto" }}>
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ flex: 1, padding: "12px 16px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: "0.82rem", fontWeight: 600, transition: "all 0.3s ease", background: activeTab === tab.id ? "var(--accent-gradient)" : "transparent", color: activeTab === tab.id ? "white" : "var(--text-secondary)", boxShadow: activeTab === tab.id ? "var(--glow-primary)" : "none", whiteSpace: "nowrap" }}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </nav>
        <div className="animate-fade-in" key={activeTab}>
          {activeTab === "gold" && <GoldPanel />}
          {activeTab === "fuel" && <FuelPanel />}
          {activeTab === "exchange" && <ExchangePanel />}
          {activeTab === "telegram" && <TelegramPanel />}
          {activeTab === "api" && <ApiDocsPanel />}
        </div>
      </main>
    </div>
  );
}

/* ==================== SHARED COMPONENTS ==================== */
const thStyle: React.CSSProperties = { padding: "14px 20px", textAlign: "left", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1, background: "var(--bg-input)" };
const tdStyle: React.CSSProperties = { padding: "12px 20px", fontSize: "0.9rem" };

function PanelHeader({ icon, title, crawledAt, crawledAtMs, fromCache, loading, onReload, error }: { icon: string; title: string; crawledAt?: string; crawledAtMs?: number; fromCache: boolean; loading: boolean; onReload: () => void; error: string }) {
  const cacheAge = crawledAtMs ? Math.round((Date.now() - crawledAtMs) / 1000) : 0;
  return (
    <div className="glass-card" style={{ padding: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 10 }}>{icon} {title}</h2>
          {crawledAt && (
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>🕐 {new Date(crawledAt).toLocaleString("vi-VN")}</span>
              <span className={`status-badge ${fromCache ? "pending" : "active"}`}>{fromCache ? `Cache (${cacheAge}s)` : "Mới crawl"}</span>
            </div>
          )}
        </div>
        <button className="btn-primary" onClick={onReload} disabled={loading}>
          {loading ? <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><span className="spinner" /> Đang crawl...</span> : "🔄 Crawl lại"}
        </button>
      </div>
      {error && <div style={{ marginTop: 12, padding: 10, background: "#ef44441a", border: "1px solid #ef444440", borderRadius: 8, color: "var(--error)", fontSize: "0.85rem" }}>❌ {error}</div>}
    </div>
  );
}

function FileInfo({ file, count, countLabel, source }: { file: string; count: number; countLabel: string; source: string }) {
  return (
    <div className="glass-card" style={{ padding: 12, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>📁 <code>{file}</code></span>
      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>•</span>
      <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>📊 {count} {countLabel}</span>
      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>•</span>
      <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", wordBreak: "break-all" }}>🌐 {source}</span>
    </div>
  );
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="glass-card" style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
      <p style={{ fontSize: "2.5rem", marginBottom: 12 }}>{icon}</p>
      <p>{text}</p>
    </div>
  );
}

function JsonPreview({ file, data }: { file: string; data: unknown }) {
  return (
    <details className="glass-card" style={{ padding: 16 }}>
      <summary style={{ cursor: "pointer", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)" }}>📄 Xem file JSON ({file})</summary>
      <div className="code-block" style={{ marginTop: 12 }}>{JSON.stringify(data, null, 2)}</div>
    </details>
  );
}

/* ==================== GOLD PANEL ==================== */
function GoldPanel() {
  const [data, setData] = useState<GoldData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editBuy, setEditBuy] = useState("");
  const [editSell, setEditSell] = useState("");
  const [fromCache, setFromCache] = useState(false);

  const fetchData = useCallback(async (force = false) => {
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/gold${force ? "?force=true" : ""}`);
      const json = await res.json();
      if (json.success) { setData(json.data); setFromCache(json.fromCache); } else setError(json.error);
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }, []);

  const handleEdit = async (code: string) => {
    try {
      const res = await fetch("/api/gold", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, updates: { buyingPrice: parseInt(editBuy), sellingPrice: parseInt(editSell) } }) });
      const json = await res.json();
      if (json.success) { setData(json.data); setEditingCode(null); } else setError(json.error);
    } catch (err) { setError((err as Error).message); }
  };

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <PanelHeader icon="💰" title="Giá Vàng Trong Nước" crawledAt={data?.crawledAt} crawledAtMs={data?.crawledAtMs} fromCache={fromCache} loading={loading} onReload={() => fetchData(true)} error={error} />
      {data && <FileInfo file="data/gold_prices.json" count={data.prices.length} countLabel="loại vàng" source={data.source} />}
      {data && (
        <div className="glass-card animate-fade-in" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ borderBottom: "1px solid var(--border-color)" }}>
              <th style={thStyle}>Loại</th><th style={thStyle}>Mua (VND/chỉ)</th><th style={thStyle}>Bán (VND/chỉ)</th><th style={thStyle}>Thay đổi</th><th style={thStyle}>Thời gian</th><th style={{ ...thStyle, width: 80 }}>Sửa</th>
            </tr></thead>
            <tbody>
              {data.prices.map((p) => (
                <tr key={p.code} style={{ borderBottom: "1px solid var(--border-color)", transition: "background 0.2s" }} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card-hover)")} onMouseLeave={(e) => (e.currentTarget.style.background = "")}>
                  {editingCode === p.code ? (<>
                    <td style={tdStyle}><span style={{ fontWeight: 700, color: "#fbbf24" }}>{p.code}</span></td>
                    <td style={tdStyle}><input className="input-field" type="number" value={editBuy} onChange={(e) => setEditBuy(e.target.value)} style={{ padding: "6px 10px", fontSize: "0.85rem" }} /></td>
                    <td style={tdStyle}><input className="input-field" type="number" value={editSell} onChange={(e) => setEditSell(e.target.value)} style={{ padding: "6px 10px", fontSize: "0.85rem" }} /></td>
                    <td style={tdStyle} colSpan={2}><div style={{ display: "flex", gap: 6 }}>
                      <button className="btn-primary" onClick={() => handleEdit(p.code)} style={{ padding: "6px 12px", fontSize: "0.75rem" }}>💾 Lưu</button>
                      <button className="btn-secondary" onClick={() => setEditingCode(null)} style={{ padding: "6px 12px", fontSize: "0.75rem" }}>Hủy</button>
                    </div></td>
                  </>) : (<>
                    <td style={tdStyle}><span style={{ fontWeight: 700, color: "#fbbf24", fontSize: "1rem" }}>{p.code}</span></td>
                    <td style={tdStyle}><span style={{ fontWeight: 600 }}>{p.buyingPrice.toLocaleString("vi-VN")}</span></td>
                    <td style={tdStyle}><span style={{ fontWeight: 600 }}>{p.sellingPrice > 0 ? p.sellingPrice.toLocaleString("vi-VN") : "—"}</span></td>
                    <td style={tdStyle}>{p.buyChange !== 0 ? <span style={{ color: p.buyChange > 0 ? "var(--success)" : "var(--error)", fontSize: "0.85rem", fontWeight: 600 }}>{p.buyChange > 0 ? "▲" : "▼"} {Math.abs(p.buyChange).toLocaleString("vi-VN")} ({p.buyChangePercent}%)</span> : <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                    <td style={tdStyle}><span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{p.dateTime}</span></td>
                    <td style={tdStyle}><button className="btn-secondary" style={{ padding: "4px 10px", fontSize: "0.75rem" }} onClick={() => { setEditingCode(p.code); setEditBuy(String(p.buyingPrice)); setEditSell(String(p.sellingPrice)); }}>✏️</button></td>
                  </>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!data && !loading && <EmptyState icon="💰" text='Nhấn "Crawl lại" để lấy dữ liệu giá vàng' />}
      {data && <JsonPreview file="data/gold_prices.json" data={data} />}
    </div>
  );
}

/* ==================== FUEL PANEL (PVOIL) ==================== */
function FuelPanel() {
  const [data, setData] = useState<FuelData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [fromCache, setFromCache] = useState(false);

  const fetchData = useCallback(async (force = false) => {
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/fuel${force ? "?force=true" : ""}`);
      const json = await res.json();
      if (json.success) { setData(json.data); setFromCache(json.fromCache); } else setError(json.error);
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }, []);

  const handleEdit = async (product: string) => {
    try {
      const res = await fetch("/api/fuel", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ product, updates: { price: parseFloat(editPrice) } }) });
      const json = await res.json();
      if (json.success) { setData(json.data); setEditingProduct(null); } else setError(json.error);
    } catch (err) { setError((err as Error).message); }
  };

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <PanelHeader icon="⛽" title="Giá Xăng Dầu PVOIL" crawledAt={data?.crawledAt} crawledAtMs={data?.crawledAtMs} fromCache={fromCache} loading={loading} onReload={() => fetchData(true)} error={error} />
      {data && <FileInfo file="data/fuel_prices.json" count={data.prices.length} countLabel="sản phẩm" source={data.source} />}
      {data && (
        <div className="glass-card animate-fade-in" style={{ padding: 0, overflow: "hidden" }}>
          {data.priceDate && <div style={{ padding: "12px 20px", background: "var(--bg-input)", fontSize: "0.85rem", color: "var(--accent-primary)", fontWeight: 600 }}>📅 Giá điều chỉnh lúc {data.priceDate}</div>}
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ borderBottom: "1px solid var(--border-color)" }}>
              <th style={{ ...thStyle, width: 40 }}>TT</th><th style={thStyle}>Mặt hàng</th><th style={thStyle}>Giá (đồng/lít)</th><th style={thStyle}>Chênh lệch</th><th style={{ ...thStyle, width: 80 }}>Sửa</th>
            </tr></thead>
            <tbody>
              {data.prices.map((p) => (
                <tr key={p.product} style={{ borderBottom: "1px solid var(--border-color)", transition: "background 0.2s" }} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card-hover)")} onMouseLeave={(e) => (e.currentTarget.style.background = "")}>
                  {editingProduct === p.product ? (<>
                    <td style={tdStyle}>{p.index}</td>
                    <td style={tdStyle}><span style={{ fontWeight: 700, color: p.product.includes("Xăng") ? "#f97316" : "#3b82f6" }}>{p.product}</span></td>
                    <td style={tdStyle}><input className="input-field" type="number" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} style={{ padding: "6px 10px", fontSize: "0.85rem" }} /></td>
                    <td style={tdStyle} colSpan={2}><div style={{ display: "flex", gap: 6 }}>
                      <button className="btn-primary" onClick={() => handleEdit(p.product)} style={{ padding: "6px 12px", fontSize: "0.75rem" }}>💾</button>
                      <button className="btn-secondary" onClick={() => setEditingProduct(null)} style={{ padding: "6px 12px", fontSize: "0.75rem" }}>✕</button>
                    </div></td>
                  </>) : (<>
                    <td style={tdStyle}><span style={{ color: "var(--text-muted)" }}>{p.index}</span></td>
                    <td style={tdStyle}><span style={{ fontWeight: 700, color: p.product.includes("Xăng") ? "#f97316" : "#3b82f6" }}>{p.product.includes("Xăng") ? "⛽" : "🛢"} {p.product}</span></td>
                    <td style={tdStyle}><span style={{ fontWeight: 600, fontSize: "1rem" }}>{p.priceText}</span></td>
                    <td style={tdStyle}>{p.change !== 0 ? <span style={{ color: p.change > 0 ? "var(--success)" : "var(--error)", fontWeight: 600 }}>{p.change > 0 ? "▲" : "▼"} {Math.abs(p.change).toLocaleString("vi-VN")}</span> : <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                    <td style={tdStyle}><button className="btn-secondary" style={{ padding: "4px 10px", fontSize: "0.75rem" }} onClick={() => { setEditingProduct(p.product); setEditPrice(String(p.price)); }}>✏️</button></td>
                  </>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!data && !loading && <EmptyState icon="⛽" text='Nhấn "Crawl lại" để lấy dữ liệu giá xăng dầu' />}
      {data && <JsonPreview file="data/fuel_prices.json" data={data} />}
    </div>
  );
}

/* ==================== EXCHANGE PANEL (Vietcombank) ==================== */
function ExchangePanel() {
  const [data, setData] = useState<ExchangeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editBuyCash, setEditBuyCash] = useState("");
  const [editSell, setEditSell] = useState("");
  const [fromCache, setFromCache] = useState(false);

  const fetchData = useCallback(async (force = false) => {
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/exchange${force ? "?force=true" : ""}`);
      const json = await res.json();
      if (json.success) { setData(json.data); setFromCache(json.fromCache); } else setError(json.error);
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }, []);

  const handleEdit = async (code: string) => {
    try {
      const res = await fetch("/api/exchange", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, updates: { buyCash: editBuyCash, sell: editSell } }) });
      const json = await res.json();
      if (json.success) { setData(json.data); setEditingCode(null); } else setError(json.error);
    } catch (err) { setError((err as Error).message); }
  };

  useEffect(() => { fetchData(); }, [fetchData]);

  const flagMap: Record<string, string> = { USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧", JPY: "🇯🇵", AUD: "🇦🇺", CAD: "🇨🇦", CHF: "🇨🇭", SGD: "🇸🇬", KRW: "🇰🇷", CNY: "🇨🇳", THB: "🇹🇭", HKD: "🇭🇰", TWD: "🇹🇼", NZD: "🇳🇿", MYR: "🇲🇾", INR: "🇮🇳", DKK: "🇩🇰", NOK: "🇳🇴", SEK: "🇸🇪", RUB: "🇷🇺", CZK: "🇨🇿", SAR: "🇸🇦", KWD: "🇰🇼", BND: "🇧🇳", LAK: "🇱🇦", KHR: "🇰🇭", MMK: "🇲🇲", PHP: "🇵🇭", IDR: "🇮🇩" };

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <PanelHeader icon="💱" title="Tỷ Giá Ngoại Tệ Vietcombank" crawledAt={data?.crawledAt} crawledAtMs={data?.crawledAtMs} fromCache={fromCache} loading={loading} onReload={() => fetchData(true)} error={error} />
      {data && <FileInfo file="data/exchange_rates.json" count={data.rates.length} countLabel="ngoại tệ" source={data.source} />}
      {data && (
        <div className="glass-card animate-fade-in" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ borderBottom: "1px solid var(--border-color)" }}>
              <th style={thStyle}>Mã NT</th><th style={thStyle}>Tên ngoại tệ</th><th style={thStyle}>Mua TM</th><th style={thStyle}>Mua CK</th><th style={thStyle}>Bán</th><th style={{ ...thStyle, width: 80 }}>Sửa</th>
            </tr></thead>
            <tbody>
              {data.rates.map((r) => (
                <tr key={r.code} style={{ borderBottom: "1px solid var(--border-color)", transition: "background 0.2s" }} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card-hover)")} onMouseLeave={(e) => (e.currentTarget.style.background = "")}>
                  {editingCode === r.code ? (<>
                    <td style={tdStyle}><span style={{ fontWeight: 700, color: "var(--accent-primary)" }}>{flagMap[r.code] || "💵"} {r.code}</span></td>
                    <td style={tdStyle}>{r.name}</td>
                    <td style={tdStyle}><input className="input-field" value={editBuyCash} onChange={(e) => setEditBuyCash(e.target.value)} style={{ padding: "6px 10px", fontSize: "0.85rem" }} /></td>
                    <td style={tdStyle}>—</td>
                    <td style={tdStyle}><input className="input-field" value={editSell} onChange={(e) => setEditSell(e.target.value)} style={{ padding: "6px 10px", fontSize: "0.85rem" }} /></td>
                    <td style={tdStyle}><div style={{ display: "flex", gap: 6 }}>
                      <button className="btn-primary" onClick={() => handleEdit(r.code)} style={{ padding: "6px 12px", fontSize: "0.75rem" }}>💾</button>
                      <button className="btn-secondary" onClick={() => setEditingCode(null)} style={{ padding: "6px 12px", fontSize: "0.75rem" }}>✕</button>
                    </div></td>
                  </>) : (<>
                    <td style={tdStyle}><span style={{ fontWeight: 700, color: "var(--accent-primary)" }}>{flagMap[r.code] || "💵"} {r.code}</span></td>
                    <td style={tdStyle}><span style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>{r.name}</span></td>
                    <td style={tdStyle}><span style={{ fontWeight: 600 }}>{r.buyCash || "—"}</span></td>
                    <td style={tdStyle}><span style={{ fontWeight: 600 }}>{r.buyTransfer || "—"}</span></td>
                    <td style={tdStyle}><span style={{ fontWeight: 600, color: "var(--success)" }}>{r.sell || "—"}</span></td>
                    <td style={tdStyle}><button className="btn-secondary" style={{ padding: "4px 10px", fontSize: "0.75rem" }} onClick={() => { setEditingCode(r.code); setEditBuyCash(r.buyCash); setEditSell(r.sell); }}>✏️</button></td>
                  </>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!data && !loading && <EmptyState icon="💱" text='Nhấn "Crawl lại" để lấy tỷ giá ngoại tệ' />}
      {data && <JsonPreview file="data/exchange_rates.json" data={data} />}
    </div>
  );
}

/* ==================== TELEGRAM PANEL ==================== */
function TelegramPanel() {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [status, setStatus] = useState<{ bot?: { ok: boolean; result?: { username: string; first_name: string } }; webhook?: { result?: { url: string; pending_update_count: number } } } | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState("");

  const checkStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/telegram/setup");
      setStatus(await res.json()); setActionMsg("");
    } catch (err) { setActionMsg(`❌ ${(err as Error).message}`); }
    finally { setLoading(false); }
  }, []);

  const setupWebhook = async () => {
    setLoading(true);
    try {
      const body: Record<string, string> = {}; if (webhookUrl) body.url = webhookUrl;
      const res = await fetch("/api/telegram/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      setActionMsg(data.success ? `✅ Webhook: ${data.webhookUrl}` : `❌ ${data.error || "Error"}`);
      await checkStatus();
    } catch (err) { setActionMsg(`❌ ${(err as Error).message}`); }
    finally { setLoading(false); }
  };

  const removeWebhook = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/telegram/setup", { method: "DELETE" });
      const data = await res.json();
      setActionMsg(data.success ? "✅ Webhook đã được xóa" : `❌ ${data.error}`);
      await checkStatus();
    } catch (err) { setActionMsg(`❌ ${(err as Error).message}`); }
    finally { setLoading(false); }
  };

  const webhookActive = status?.webhook?.result?.url && status.webhook.result.url.length > 0;

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <div className="glass-card" style={{ padding: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: "1.15rem", fontWeight: 600, display: "flex", alignItems: "center", gap: 10 }}>🤖 Telegram Bot</h2>
          <button className="btn-secondary" onClick={checkStatus} disabled={loading} style={{ padding: "8px 16px", fontSize: "0.8rem" }}>{loading ? <span className="spinner" style={{ display: "inline-block" }} /> : "🔄 Kiểm tra"}</button>
        </div>
        {status ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            <div style={{ background: "var(--bg-input)", borderRadius: 12, padding: 16, border: "1px solid var(--border-color)" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Bot</div>
              <p style={{ fontWeight: 600 }}>{status.bot?.result ? `@${status.bot.result.username}` : "Chưa kết nối"}</p>
            </div>
            <div style={{ background: "var(--bg-input)", borderRadius: 12, padding: 16, border: "1px solid var(--border-color)" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Webhook</div>
              <div className={`status-badge ${webhookActive ? "active" : "inactive"}`}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: webhookActive ? "var(--success)" : "var(--error)", display: "inline-block" }} />{webhookActive ? "Active" : "Inactive"}
              </div>
            </div>
            <div style={{ background: "var(--bg-input)", borderRadius: 12, padding: 16, border: "1px solid var(--border-color)" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Pending</div>
              <p style={{ fontWeight: 600 }}>{String(status.webhook?.result?.pending_update_count ?? "—")}</p>
            </div>
          </div>
        ) : <div style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>Nhấn &quot;Kiểm tra&quot; để xem trạng thái</div>}
      </div>

      <div className="glass-card" style={{ padding: 28 }}>
        <h2 style={{ fontSize: "1.15rem", fontWeight: 600, marginBottom: 20 }}>⚙️ Thiết lập Webhook</h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <input className="input-field" type="text" placeholder="URL công khai (https://...)" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} style={{ flex: 1, minWidth: 280 }} />
          <button className="btn-primary" onClick={setupWebhook} disabled={loading}>🚀 Thiết lập</button>
          <button className="btn-danger" onClick={removeWebhook} disabled={loading}>🗑 Xóa</button>
        </div>
        {actionMsg && <div className="animate-slide-in" style={{ marginTop: 16, padding: 12, borderRadius: 10, background: actionMsg.startsWith("✅") ? "#22c55e1a" : "#ef44441a", border: `1px solid ${actionMsg.startsWith("✅") ? "#22c55e40" : "#ef444440"}`, color: actionMsg.startsWith("✅") ? "var(--success)" : "var(--error)", fontSize: "0.85rem" }}>{actionMsg}</div>}
      </div>

      <div className="glass-card" style={{ padding: 28 }}>
        <h2 style={{ fontSize: "1.15rem", fontWeight: 600, marginBottom: 16 }}>📋 Bot Commands</h2>
        <div style={{ display: "grid", gap: 8 }}>
          {[
            { cmd: "/start", desc: "Bắt đầu sử dụng bot" },
            { cmd: "/giavang", desc: "Giá vàng (cache 5 phút)" },
            { cmd: "/giaxang", desc: "Giá xăng dầu PVOIL (cache 5 phút)" },
            { cmd: "/ngoaite", desc: "Tỷ giá ngoại tệ VCB (cache 5 phút)" },
            { cmd: "/scrape [url]", desc: "Scrape nội dung từ URL" },
            { cmd: "/info", desc: "Thông tin bot" },
            { cmd: "/help", desc: "Trợ giúp" },
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", gap: 14, padding: "10px 14px", background: "var(--bg-input)", borderRadius: 10, alignItems: "center" }}>
              <code style={{ color: "var(--accent-primary)", fontFamily: "var(--font-jetbrains), monospace", fontSize: "0.85rem", fontWeight: 600, minWidth: 130 }}>{item.cmd}</code>
              <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>{item.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ==================== API DOCS PANEL ==================== */
function ApiDocsPanel() {
  const endpoints = [
    { method: "GET", path: "/api/gold", desc: "Giá vàng (cache 5p, ?force=true)" },
    { method: "POST", path: "/api/gold", desc: "Force crawl giá vàng" },
    { method: "PUT", path: "/api/gold", desc: "Sửa giá vàng" },
    { method: "GET", path: "/api/fuel", desc: "Giá xăng PVOIL (cache 5p)" },
    { method: "POST", path: "/api/fuel", desc: "Force crawl giá xăng" },
    { method: "PUT", path: "/api/fuel", desc: "Sửa giá xăng" },
    { method: "GET", path: "/api/exchange", desc: "Tỷ giá VCB (cache 5p)" },
    { method: "POST", path: "/api/exchange", desc: "Force crawl tỷ giá" },
    { method: "PUT", path: "/api/exchange", desc: "Sửa tỷ giá" },
    { method: "POST", path: "/api/telegram/webhook", desc: "Nhận updates Telegram" },
    { method: "GET", path: "/api/telegram/setup", desc: "Kiểm tra webhook" },
    { method: "POST", path: "/api/telegram/setup", desc: "Thiết lập webhook" },
    { method: "DELETE", path: "/api/telegram/setup", desc: "Xóa webhook" },
    { method: "POST", path: "/api/scrape", desc: "Scrape trang web" },
  ];
  const mc: Record<string, string> = { GET: "#22c55e", POST: "#3b82f6", DELETE: "#ef4444", PUT: "#eab308" };

  return (
    <div className="glass-card" style={{ padding: 28 }}>
      <h2 style={{ fontSize: "1.15rem", fontWeight: 600, marginBottom: 20 }}>📡 API Endpoints</h2>
      <div style={{ display: "grid", gap: 8 }}>
        {endpoints.map((ep, i) => (
          <div key={i} style={{ display: "flex", gap: 12, padding: "10px 14px", background: "var(--bg-input)", borderRadius: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ background: `${mc[ep.method]}20`, color: mc[ep.method], padding: "3px 10px", borderRadius: 6, fontSize: "0.7rem", fontWeight: 700, fontFamily: "monospace", border: `1px solid ${mc[ep.method]}40`, minWidth: 55, textAlign: "center" }}>{ep.method}</span>
            <code style={{ fontSize: "0.82rem", fontFamily: "var(--font-jetbrains), monospace", color: "var(--text-primary)", minWidth: 200 }}>{ep.path}</code>
            <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>{ep.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
