import { useState, useRef } from "react";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const GEMINI_API_KEY = "AIzaSyDA_I7hlqI--tktFwkaencL40cye1jIq5Q";
const FLW_PUBLIC_KEY = "FLWPUBK-07b39e1b497a525e3ef38dce1ba774a4-X";
const PRICE_PER_BID = 3; // USD per bid

const JOB_TYPES = [
  { id: "painting", label: "Painting", icon: "🎨", color: "#E8572A" },
  { id: "cleaning", label: "Cleaning", icon: "🧹", color: "#2A9DE8" },
  { id: "landscaping", label: "Landscaping", icon: "🌿", color: "#2AE87B" },
  { id: "handyman", label: "Handyman", icon: "🔧", color: "#E8C42A" },
];

const EXAMPLE_INPUTS = {
  painting: "Paint living room and hallway, eggshell white, walls only, 2 days labor, $380 paint supplies",
  cleaning: "Deep clean 3BR/2BA home, move-out clean, includes oven and fridge, 1 day job",
  landscaping: "Weekly lawn mow + edge for 1/4 acre lot, includes leaf blowout, 3-month contract",
  handyman: "Install ceiling fan in bedroom, patch 3 drywall holes, replace 2 door handles",
};

// ─── GEMINI API ───────────────────────────────────────────────────────────────
async function generateBid(jobType, jobDescription, customerName, contractorName) {
  const prompt = `You are an expert contractor bid writer. Generate a PROFESSIONAL contractor bid proposal.

Job Type: ${jobType}
Contractor: ${contractorName}
Customer: ${customerName}
Job Description: ${jobDescription}

Respond ONLY in this exact JSON format (no markdown, no backticks):
{
  "proposalTitle": "short professional title",
  "scopeOfWork": ["bullet 1", "bullet 2", "bullet 3", "bullet 4"],
  "lineItems": [
    {"description": "item name", "qty": 1, "unit": "unit", "unitPrice": 100, "total": 100}
  ],
  "subtotal": 500,
  "tax": 40,
  "total": 540,
  "timeline": "e.g. 2 business days",
  "warranty": "e.g. 30-day workmanship guarantee",
  "paymentTerms": "e.g. 50% upfront, 50% on completion",
  "disclaimer": "professional legal disclaimer about 1-2 sentences",
  "nextSteps": ["Step 1", "Step 2", "Step 3"]
}`;

  const isProduction = import.meta.env.PROD;
  const apiUrl = isProduction ? "/.netlify/functions/gemini" : `/api/gemini/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 1500 },
    }),
  });
  const data = await res.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const clean = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

// ─── FLUTTERWAVE PAYMENT ──────────────────────────────────────────────────────
function launchFlutterwave({ email, name, onSuccess }) {
  if (!window.FlutterwaveCheckout) {
    alert("Payment system loading... please try again in a moment.");
    return;
  }
  window.FlutterwaveCheckout({
    public_key: FLW_PUBLIC_KEY,
    tx_ref: `bid_${Date.now()}`,
    amount: PRICE_PER_BID,
    currency: "USD",
    payment_options: "card,mobilemoney,ussd",
    customer: { email, name },
    customizations: {
      title: "QuickQuote AI",
      description: "Professional Bid Generation",
      logo: "https://i.imgur.com/2GWbEIf.png",
    },
    callback: (response) => {
      if (response.status === "successful") onSuccess();
    },
    onclose: () => {},
  });
}

// ─── PDF GENERATION ───────────────────────────────────────────────────────────
function generatePDF(bid, jobType, contractorName, customerName) {
  const jobMeta = JOB_TYPES.find((j) => j.id === jobType);
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
  const bidNumber = `QQ-${Date.now().toString().slice(-6)}`;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Georgia', serif; color: #1a1a1a; background: #fff; }
  .header { background: #1a1a1a; color: #fff; padding: 40px 48px; display: flex; justify-content: space-between; align-items: flex-start; }
  .logo { font-size: 26px; font-weight: bold; letter-spacing: -1px; }
  .logo span { color: #E8572A; }
  .badge { background: #E8572A; color: white; padding: 6px 14px; border-radius: 4px; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; margin-top: 8px; display: inline-block; }
  .meta { text-align: right; font-size: 13px; opacity: 0.7; line-height: 1.8; }
  .meta strong { color: #fff; opacity: 1; }
  .body { padding: 48px; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 40px; padding-bottom: 40px; border-bottom: 2px solid #f0f0f0; }
  .party-label { font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: #999; margin-bottom: 6px; }
  .party-name { font-size: 20px; font-weight: bold; color: #1a1a1a; }
  .section-title { font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: #999; margin-bottom: 16px; margin-top: 36px; }
  .scope ul { list-style: none; }
  .scope ul li { padding: 10px 0; border-bottom: 1px solid #f5f5f5; font-size: 14px; padding-left: 20px; position: relative; }
  .scope ul li::before { content: "→"; position: absolute; left: 0; color: #E8572A; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  thead { background: #1a1a1a; color: white; }
  thead th { padding: 12px 16px; text-align: left; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; }
  tbody tr { border-bottom: 1px solid #f0f0f0; }
  tbody tr:nth-child(even) { background: #fafafa; }
  tbody td { padding: 12px 16px; }
  .totals { margin-left: auto; width: 280px; margin-top: 20px; }
  .totals-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; border-bottom: 1px solid #f0f0f0; }
  .totals-total { display: flex; justify-content: space-between; padding: 14px 0; font-size: 20px; font-weight: bold; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 8px; }
  .info-box { background: #f9f9f9; border-left: 3px solid #E8572A; padding: 16px 20px; border-radius: 0 6px 6px 0; }
  .info-box-label { font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: #999; margin-bottom: 4px; }
  .info-box-value { font-size: 14px; font-weight: 600; color: #1a1a1a; }
  .next-steps { background: #1a1a1a; color: white; padding: 28px 32px; border-radius: 8px; margin-top: 36px; }
  .next-steps h3 { font-size: 11px; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 16px; color: #E8572A; }
  .next-steps ol { list-style: none; counter-reset: steps; }
  .next-steps ol li { counter-increment: steps; padding: 8px 0; font-size: 14px; display: flex; align-items: center; gap: 12px; }
  .next-steps ol li::before { content: counter(steps); background: #E8572A; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; flex-shrink: 0; }
  .disclaimer { margin-top: 36px; padding: 20px; background: #fff8f5; border: 1px solid #fde8df; border-radius: 6px; font-size: 12px; color: #888; line-height: 1.6; }
  .footer { margin-top: 48px; padding-top: 24px; border-top: 2px solid #f0f0f0; display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #bbb; }
  .sig-line { border-top: 1px solid #ccc; width: 200px; padding-top: 8px; }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="logo">Quick<span>Quote</span> AI</div>
    <div class="badge">${jobMeta?.label} Proposal</div>
  </div>
  <div class="meta">
    <div><strong>Bid #</strong> ${bidNumber}</div>
    <div><strong>Date</strong> ${date}</div>
    <div><strong>Valid for</strong> 30 days</div>
  </div>
</div>

<div class="body">
  <div class="parties">
    <div>
      <div class="party-label">Prepared By</div>
      <div class="party-name">${contractorName}</div>
      <div style="color:#999;font-size:13px;margin-top:4px;">Independent Contractor</div>
    </div>
    <div>
      <div class="party-label">Prepared For</div>
      <div class="party-name">${customerName}</div>
    </div>
  </div>

  <div class="section-title">Scope of Work</div>
  <div class="scope">
    <ul>${bid.scopeOfWork.map((s) => `<li>${s}</li>`).join("")}</ul>
  </div>

  <div class="section-title">Cost Breakdown</div>
  <table>
    <thead>
      <tr><th>Description</th><th>Qty</th><th>Unit</th><th>Unit Price</th><th>Total</th></tr>
    </thead>
    <tbody>
      ${bid.lineItems.map((item) => `
      <tr>
        <td>${item.description}</td>
        <td>${item.qty}</td>
        <td>${item.unit}</td>
        <td>$${item.unitPrice.toFixed(2)}</td>
        <td>$${item.total.toFixed(2)}</td>
      </tr>`).join("")}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-row"><span>Subtotal</span><span>$${bid.subtotal.toFixed(2)}</span></div>
    <div class="totals-row"><span>Tax / Materials Markup</span><span>$${bid.tax.toFixed(2)}</span></div>
    <div class="totals-total"><span>TOTAL</span><span style="color:#E8572A">$${bid.total.toFixed(2)}</span></div>
  </div>

  <div class="section-title">Project Details</div>
  <div class="info-grid">
    <div class="info-box">
      <div class="info-box-label">Timeline</div>
      <div class="info-box-value">${bid.timeline}</div>
    </div>
    <div class="info-box">
      <div class="info-box-label">Payment Terms</div>
      <div class="info-box-value">${bid.paymentTerms}</div>
    </div>
    <div class="info-box" style="grid-column: 1 / -1;">
      <div class="info-box-label">Warranty</div>
      <div class="info-box-value">${bid.warranty}</div>
    </div>
  </div>

  <div class="next-steps">
    <h3>Next Steps to Get Started</h3>
    <ol>${bid.nextSteps.map((s) => `<li>${s}</li>`).join("")}</ol>
  </div>

  <div class="disclaimer"><strong>Disclaimer:</strong> ${bid.disclaimer}</div>

  <div class="footer">
    <div>
      <div class="sig-line">Contractor Signature</div>
      <div style="margin-top:4px;">${contractorName}</div>
    </div>
    <div style="text-align:right;">
      <div class="sig-line">Client Signature / Date</div>
      <div style="margin-top:4px;">${customerName}</div>
    </div>
  </div>
</div>
</body>
</html>`;

  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 600);
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const S = {
  app: {
    minHeight: "100vh",
    background: "#0f0f0f",
    fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
    color: "#f0ede8",
    position: "relative",
    overflow: "hidden",
  },
  grain: {
    position: "fixed", inset: 0, opacity: 0.04, pointerEvents: "none", zIndex: 0,
    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
  },
  container: { maxWidth: 780, margin: "0 auto", padding: "0 24px", position: "relative", zIndex: 1 },
  nav: { padding: "28px 0 0", display: "flex", alignItems: "center", justifyContent: "space-between" },
  logo: { fontSize: 22, fontWeight: 800, letterSpacing: "-1px", color: "#f0ede8" },
  logoAccent: { color: "#E8572A" },
  badge: {
    background: "#1e1e1e", border: "1px solid #2a2a2a", borderRadius: 20,
    padding: "6px 14px", fontSize: 12, color: "#888", letterSpacing: "0.5px",
  },
  hero: { paddingTop: 72, paddingBottom: 56, textAlign: "center" },
  heroEyebrow: {
    display: "inline-block", background: "#1e1e1e", border: "1px solid #E8572A33",
    color: "#E8572A", borderRadius: 20, padding: "5px 14px", fontSize: 12,
    letterSpacing: "1px", textTransform: "uppercase", marginBottom: 24,
  },
  heroTitle: {
    fontSize: "clamp(36px, 6vw, 60px)", fontWeight: 800, lineHeight: 1.1,
    letterSpacing: "-2px", marginBottom: 16,
  },
  heroSub: { fontSize: 17, color: "#888", maxWidth: 480, margin: "0 auto", lineHeight: 1.6 },
  card: {
    background: "#161616", border: "1px solid #242424", borderRadius: 16,
    padding: 32, marginBottom: 20,
  },
  cardTitle: { fontSize: 13, letterSpacing: "1.5px", textTransform: "uppercase", color: "#666", marginBottom: 20 },
  jobGrid: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 },
  jobBtn: (selected, color) => ({
    background: selected ? "#1e1e1e" : "transparent",
    border: `1.5px solid ${selected ? color : "#242424"}`,
    borderRadius: 10, padding: "14px 16px", cursor: "pointer",
    color: selected ? "#f0ede8" : "#888", textAlign: "left",
    transition: "all 0.15s ease", display: "flex", alignItems: "center", gap: 10,
  }),
  jobIcon: { fontSize: 20 },
  jobLabel: { fontSize: 14, fontWeight: 600 },
  label: { display: "block", fontSize: 12, letterSpacing: "1px", textTransform: "uppercase", color: "#666", marginBottom: 8 },
  input: {
    width: "100%", background: "#0f0f0f", border: "1.5px solid #242424",
    borderRadius: 10, padding: "12px 16px", color: "#f0ede8", fontSize: 15,
    outline: "none", fontFamily: "inherit", transition: "border-color 0.15s",
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%", background: "#0f0f0f", border: "1.5px solid #242424",
    borderRadius: 10, padding: "14px 16px", color: "#f0ede8", fontSize: 15,
    outline: "none", fontFamily: "inherit", resize: "vertical", minHeight: 100,
    transition: "border-color 0.15s", boxSizing: "border-box", lineHeight: 1.6,
  },
  hint: { fontSize: 12, color: "#555", marginTop: 8, lineHeight: 1.5 },
  row: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 },
  btn: (variant = "primary") => ({
    width: "100%", padding: "15px 24px", borderRadius: 10, border: "none",
    cursor: "pointer", fontSize: 15, fontWeight: 700, letterSpacing: "0.3px",
    fontFamily: "inherit", transition: "all 0.15s ease",
    background: variant === "primary" ? "#E8572A" : "#1e1e1e",
    color: variant === "primary" ? "#fff" : "#f0ede8",
    border: variant === "secondary" ? "1.5px solid #2a2a2a" : "none",
  }),
  pricePill: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10,
    padding: "12px 20px", marginBottom: 16, fontSize: 14, color: "#888",
  },
  // Result styles
  resultCard: {
    background: "#161616", border: "1px solid #E8572A33", borderRadius: 16, padding: 32, marginBottom: 20,
  },
  resultTitle: { fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 4, color: "#f0ede8" },
  resultSub: { fontSize: 13, color: "#666", marginBottom: 28 },
  scopeItem: { display: "flex", gap: 10, padding: "10px 0", borderBottom: "1px solid #1e1e1e", fontSize: 14, color: "#ccc", alignItems: "flex-start" },
  arrow: { color: "#E8572A", flexShrink: 0, marginTop: 1 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 14, marginTop: 8 },
  th: { textAlign: "left", padding: "10px 12px", fontSize: 11, letterSpacing: "1px", textTransform: "uppercase", color: "#666", borderBottom: "1px solid #242424" },
  td: { padding: "12px 12px", borderBottom: "1px solid #1e1e1e", color: "#ccc" },
  totalRow: { display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #1e1e1e", fontSize: 14, color: "#999" },
  grandTotal: { display: "flex", justifyContent: "space-between", padding: "16px 0", fontSize: 22, fontWeight: 800, color: "#f0ede8" },
  infoGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 },
  infoBox: { background: "#0f0f0f", borderLeft: "2px solid #E8572A", padding: "14px 16px", borderRadius: "0 8px 8px 0" },
  infoBoxLabel: { fontSize: 11, letterSpacing: "1px", textTransform: "uppercase", color: "#555", marginBottom: 4 },
  infoBoxVal: { fontSize: 14, fontWeight: 600, color: "#f0ede8" },
  nextStep: { display: "flex", gap: 12, padding: "10px 0", fontSize: 14, color: "#ccc", alignItems: "center" },
  stepNum: { background: "#E8572A", color: "#fff", width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0 },
  disclaimer: { marginTop: 20, padding: "16px 20px", background: "#1a1a1a", border: "1px solid #242424", borderRadius: 8, fontSize: 12, color: "#666", lineHeight: 1.7 },
  footer: { textAlign: "center", padding: "40px 0", color: "#444", fontSize: 12, lineHeight: 1.8 },
};

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [step, setStep] = useState("form"); // form | pay | loading | result
  const [jobType, setJobType] = useState("painting");
  const [jobDescription, setJobDescription] = useState("");
  const [contractorName, setContractorName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [email, setEmail] = useState("");
  const [bid, setBid] = useState(null);
  const [error, setError] = useState("");

  const selectedJob = JOB_TYPES.find((j) => j.id === jobType);

  const handlePay = () => {
    if (!jobDescription || !contractorName || !customerName || !email) {
      setError("Please fill in all fields.");
      return;
    }
    setError("");
    setStep("pay");
    launchFlutterwave({
      email,
      name: contractorName,
      onSuccess: handleGenerate,
    });
  };

  const handleGenerate = async () => {
    setStep("loading");
    try {
      const result = await generateBid(jobType, jobDescription, customerName, contractorName);
      setBid(result);
      setStep("result");
    } catch (e) {
      setError("AI generation failed. Please try again.");
      setStep("form");
    }
  };

  // DEV: Skip payment for testing
  const handleDevSkip = async () => {
    if (!jobDescription || !contractorName || !customerName) {
      setError("Fill in all fields first.");
      return;
    }
    setError("");
    await handleGenerate();
  };

  return (
    <div style={S.app}>
      <div style={S.grain} />
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&display=swap" rel="stylesheet" />
      <script src="https://checkout.flutterwave.com/v3.js" async />

      <div style={S.container}>
        {/* NAV */}
        <nav style={S.nav}>
          <div style={S.logo}>Quick<span style={S.logoAccent}>Quote</span></div>
          <div style={S.badge}>Professional Bids in 10 Seconds</div>
        </nav>

        {/* HERO */}
        {step === "form" && (
          <div style={S.hero}>
            <div style={S.heroEyebrow}>For Painters · Cleaners · Landscapers · Handymen</div>
            <h1 style={S.heroTitle}>Stop losing jobs to<br />bad paperwork.</h1>
            <p style={S.heroSub}>Type your job details. Get a professional PDF proposal in 10 seconds. Look like a $200/hr contractor.</p>
          </div>
        )}

        {/* ── FORM ─── */}
        {step === "form" && (
          <>
            <div style={S.card}>
              <div style={S.cardTitle}>1 · Job Type</div>
              <div style={S.jobGrid}>
                {JOB_TYPES.map((j) => (
                  <button key={j.id} style={S.jobBtn(jobType === j.id, j.color)} onClick={() => { setJobType(j.id); setJobDescription(""); }}>
                    <span style={S.jobIcon}>{j.icon}</span>
                    <span style={S.jobLabel}>{j.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div style={S.card}>
              <div style={S.cardTitle}>2 · Your Details</div>
              <div style={S.row}>
                <div>
                  <label style={S.label}>Your Name / Business</label>
                  <input style={S.input} placeholder="Mike's Painting Co." value={contractorName} onChange={(e) => setContractorName(e.target.value)} />
                </div>
                <div>
                  <label style={S.label}>Client Name</label>
                  <input style={S.input} placeholder="John Smith" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                </div>
              </div>
              <label style={S.label}>Your Email (for receipt)</label>
              <input style={{ ...S.input, marginBottom: 0 }} placeholder="you@email.com" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div style={S.card}>
              <div style={S.cardTitle}>3 · Describe the Job</div>
              <textarea
                style={S.textarea}
                placeholder={EXAMPLE_INPUTS[jobType]}
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
              />
              <p style={S.hint}>
                Include: what you're doing, materials, time, your price expectation.<br />
                Example: "{EXAMPLE_INPUTS[jobType]}"
              </p>
            </div>

            {error && <div style={{ color: "#E8572A", fontSize: 13, marginBottom: 12, textAlign: "center" }}>{error}</div>}

            <div style={S.pricePill}>
              <span>💳</span>
              <span>One bid = <strong style={{ color: "#f0ede8" }}>${PRICE_PER_BID}</strong> · Instant professional PDF</span>
            </div>

            <button style={S.btn("primary")} onClick={handlePay}>
              Generate My Bid → Pay ${PRICE_PER_BID}
            </button>

            <button style={{ ...S.btn("secondary"), marginTop: 10, fontSize: 12, color: "#555" }} onClick={handleDevSkip}>
              [DEV] Skip Payment & Test
            </button>
          </>
        )}

        {/* ── LOADING ─── */}
        {step === "loading" && (
          <div style={{ textAlign: "center", padding: "120px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 24, animation: "spin 1s linear infinite" }}>⚙️</div>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Building your bid...</div>
            <div style={{ color: "#666", fontSize: 14 }}>AI is crafting a professional proposal. This takes ~5 seconds.</div>
          </div>
        )}

        {/* ── RESULT ─── */}
        {step === "result" && bid && (
          <>
            <div style={{ paddingTop: 48, paddingBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 12, color: "#E8572A", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 6 }}>✓ Bid Ready</div>
                <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.5px" }}>Your Professional Proposal</h2>
              </div>
              <button style={{ ...S.btn("secondary"), width: "auto", padding: "12px 20px", fontSize: 13 }} onClick={() => { setStep("form"); setBid(null); }}>
                ← New Bid
              </button>
            </div>

            <div style={S.resultCard}>
              <div style={S.resultTitle}>{bid.proposalTitle}</div>
              <div style={S.resultSub}>Prepared for {customerName} · by {contractorName}</div>

              <div style={{ fontSize: 11, letterSpacing: "1.5px", textTransform: "uppercase", color: "#555", marginBottom: 12 }}>Scope of Work</div>
              {bid.scopeOfWork.map((s, i) => (
                <div key={i} style={S.scopeItem}><span style={S.arrow}>→</span><span>{s}</span></div>
              ))}

              <div style={{ fontSize: 11, letterSpacing: "1.5px", textTransform: "uppercase", color: "#555", margin: "24px 0 12px" }}>Cost Breakdown</div>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Description</th>
                    <th style={S.th}>Qty</th>
                    <th style={S.th}>Unit</th>
                    <th style={{ ...S.th, textAlign: "right" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {bid.lineItems.map((item, i) => (
                    <tr key={i}>
                      <td style={S.td}>{item.description}</td>
                      <td style={S.td}>{item.qty}</td>
                      <td style={S.td}>{item.unit}</td>
                      <td style={{ ...S.td, textAlign: "right" }}>${item.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ maxWidth: 280, marginLeft: "auto", marginTop: 16 }}>
                <div style={S.totalRow}><span>Subtotal</span><span>${bid.subtotal.toFixed(2)}</span></div>
                <div style={S.totalRow}><span>Tax / Markup</span><span>${bid.tax.toFixed(2)}</span></div>
                <div style={S.grandTotal}><span>Total</span><span style={{ color: "#E8572A" }}>${bid.total.toFixed(2)}</span></div>
              </div>

              <div style={{ fontSize: 11, letterSpacing: "1.5px", textTransform: "uppercase", color: "#555", margin: "24px 0 12px" }}>Project Details</div>
              <div style={S.infoGrid}>
                <div style={S.infoBox}><div style={S.infoBoxLabel}>Timeline</div><div style={S.infoBoxVal}>{bid.timeline}</div></div>
                <div style={S.infoBox}><div style={S.infoBoxLabel}>Payment Terms</div><div style={S.infoBoxVal}>{bid.paymentTerms}</div></div>
                <div style={{ ...S.infoBox, gridColumn: "1 / -1" }}><div style={S.infoBoxLabel}>Warranty</div><div style={S.infoBoxVal}>{bid.warranty}</div></div>
              </div>

              <div style={{ fontSize: 11, letterSpacing: "1.5px", textTransform: "uppercase", color: "#555", margin: "24px 0 12px" }}>Next Steps</div>
              {bid.nextSteps.map((s, i) => (
                <div key={i} style={S.nextStep}>
                  <div style={S.stepNum}>{i + 1}</div>
                  <span>{s}</span>
                </div>
              ))}

              <div style={S.disclaimer}><strong>Disclaimer:</strong> {bid.disclaimer}</div>
            </div>

            <button style={S.btn("primary")} onClick={() => generatePDF(bid, jobType, contractorName, customerName)}>
              🖨️ Download / Print PDF
            </button>
            <button style={{ ...S.btn("secondary"), marginTop: 10 }} onClick={() => { setStep("form"); setBid(null); }}>
              Generate Another Bid
            </button>
          </>
        )}

        <div style={S.footer}>
          <div>QuickQuote AI · Built for blue-collar pros 🔧</div>
          <div style={{ marginTop: 4 }}>Powered by Gemini · Payments by Flutterwave</div>
        </div>
      </div>
    </div>
  );
}
