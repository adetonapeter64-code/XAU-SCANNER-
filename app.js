const $ = (id) => document.getElementById(id);
let currentFile = null;
let currentAnalysis = null;
let currentAnalyzedAt = null;
const HISTORY_KEY = "botxau.scans.v1";

function readHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; }
}
function writeHistory(items) { localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 30))); }
function safeText(value, fallback = "—") {
  if (value === null || value === undefined || value === "") return fallback;
  return Array.isArray(value) ? value.join(", ") : String(value);
}
function fillList(id, items) {
  const el = $(id); el.replaceChildren();
  const values = Array.isArray(items) && items.length ? items : ["No clear observations returned."];
  values.forEach(value => { const li = document.createElement("li"); li.textContent = safeText(value); el.appendChild(li); });
}
function showAnalysis(analysis, at) {
  currentAnalysis = analysis; currentAnalyzedAt = at || new Date().toISOString();
  $("emptyState").classList.add("hidden");
  $("signalResult").classList.remove("hidden");
  const decision = String(analysis.decision || "NO TRADE").toUpperCase();
  $("decisionPill").textContent = decision;
  $("decisionPill").className = "decision-pill " + (decision === "BUY" ? "buy" : decision === "SELL" ? "sell" : "neutral");
  $("latestDecision").textContent = decision;
  $("latestTime").textContent = new Date(currentAnalyzedAt).toLocaleString();
  $("signalTitle").textContent = decision;
  $("signalEmoji").textContent = decision === "BUY" ? "🟢" : decision === "SELL" ? "🔴" : "🟡";
  $("signalTime").textContent = `${safeText(analysis.confidence, "Unrated")} confidence · ${new Date(currentAnalyzedAt).toLocaleString()}`;
  $("entryValue").textContent = safeText(analysis.entry);
  $("slValue").textContent = safeText(analysis.stopLoss);
  $("tpValue").textContent = safeText(analysis.takeProfit);
  $("tfValue").textContent = safeText(analysis.timeframe);
  fillList("setupList", analysis.setup);
  fillList("reasonList", analysis.reasons);
  fillList("missingList", analysis.missing);
  $("warningText").textContent = safeText(analysis.warning, "Always verify current market conditions before acting.");
}
function renderHistory() {
  const history = readHistory();
  $("scanCount").textContent = String(history.length);
  const list = $("historyList"); list.replaceChildren();
  if (!history.length) { const p = document.createElement("p"); p.className = "muted"; p.textContent = "Your saved scans will appear here."; list.appendChild(p); return; }
  history.forEach(item => {
    const row = document.createElement("div"); row.className = "history-item";
    const left = document.createElement("div"); const strong = document.createElement("strong");
    strong.textContent = `${item.decision || "NO TRADE"} · XAU/USD`;
    const small = document.createElement("small"); small.textContent = `${new Date(item.at).toLocaleString()} · Entry: ${safeText(item.entry)}`;
    left.append(strong, small);
    const pill = document.createElement("span"); pill.className = "decision-pill " + (item.decision === "BUY" ? "buy" : item.decision === "SELL" ? "sell" : "neutral"); pill.textContent = item.decision || "NO TRADE";
    row.append(left, pill); list.appendChild(row);
  });
}
async function refreshStatus() {
  try {
    const r = await fetch("/api/status"); const s = await r.json();
    $("scanStatus").textContent = s.aiConfigured ? "AI key detected. Screenshot analysis is available." : "Setup needed: add OPENAI_API_KEY to the server .env file.";
    if (s.livePriceConfigured) refreshPrice();
    else $("priceMeta").textContent = "Add TWELVE_DATA_API_KEY for live price verification";
  } catch { $("scanStatus").textContent = "Server not reachable. Start the Node server and reload."; }
}
async function refreshPrice() {
  try {
    const r = await fetch("/api/price"); const d = await r.json();
    if (!r.ok) throw new Error(d.error || "Price unavailable");
    $("livePrice").textContent = Number(d.price).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:3});
    $("priceMeta").textContent = `Twelve Data · ${new Date(d.retrievedAt).toLocaleTimeString()}`;
  } catch (e) { $("livePrice").textContent = "Unavailable"; $("priceMeta").textContent = e.message; }
}
$("chartFile").addEventListener("change", event => {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { alert("Choose a PNG, JPG, or WEBP image."); event.target.value = ""; return; }
  if (file.size > 8 * 1024 * 1024) { alert("Image must be smaller than 8 MB."); event.target.value = ""; return; }
  currentFile = file;
  $("preview").src = URL.createObjectURL(file);
  $("previewWrap").classList.remove("hidden");
  $("scanStatus").textContent = `${file.name} selected. Ready to analyze.`;
});
$("removeImage").addEventListener("click", () => {
  currentFile = null; $("chartFile").value = ""; $("preview").removeAttribute("src"); $("previewWrap").classList.add("hidden");
});
$("scanButton").addEventListener("click", async () => {
  if (!currentFile) { $("scanStatus").textContent = "Please choose a screenshot first."; return; }
  const button = $("scanButton"); button.disabled = true; button.textContent = "⏳ ANALYZING…";
  $("scanStatus").textContent = "Sending the screenshot for analysis. This can take a little while.";
  try {
    const form = new FormData(); form.append("chart", currentFile); form.append("timeframe", $("timeframe").value);
    const response = await fetch("/api/analyze", { method: "POST", body: form });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Analysis failed.");
    showAnalysis(data.analysis, data.analyzedAt);
    $("scanStatus").textContent = "Analysis complete. Check the visible price scale and verify the live market before trading.";
  } catch (error) {
    $("scanStatus").textContent = error.message;
  } finally { button.disabled = false; button.innerHTML = "⌕ &nbsp; ANALYZE SCREENSHOT"; }
});
$("saveSignal").addEventListener("click", () => {
  if (!currentAnalysis) return;
  const history = readHistory();
  history.unshift({
    decision: String(currentAnalysis.decision || "NO TRADE").toUpperCase(),
    at: currentAnalyzedAt || new Date().toISOString(),
    entry: safeText(currentAnalysis.entry),
    analysis: currentAnalysis
  });
  writeHistory(history); renderHistory(); $("scanStatus").textContent = "Signal saved in this browser's history.";
});
$("clearHistory").addEventListener("click", () => {
  if (confirm("Clear all saved scan history in this browser?")) { writeHistory([]); renderHistory(); }
});
renderHistory(); refreshStatus();
