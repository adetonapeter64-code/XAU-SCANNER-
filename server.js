require("dotenv").config();
const express = require("express");
const multer = require("multer");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(png|jpeg|webp)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error("Please upload a PNG, JPG, or WEBP image."));
  }
});

app.use(express.json({ limit: "1mb" }));
// Serve the dashboard whether files are in /public (recommended) or repository root.
const publicDir = path.join(__dirname, "public");
const fs = require("fs");
const dashboardDir = fs.existsSync(path.join(publicDir, "index.html")) ? publicDir : __dirname;
app.get("/", (_req, res) => res.sendFile(path.join(dashboardDir, "index.html")));
app.get("/app.js", (_req, res) => res.sendFile(path.join(dashboardDir, "app.js")));
app.get("/styles.css", (_req, res) => res.sendFile(path.join(dashboardDir, "styles.css")));

app.get("/api/status", (_req, res) => {
  res.json({
    ok: true,
    aiConfigured: Boolean(process.env.OPENAI_API_KEY),
    livePriceConfigured: Boolean(process.env.TWELVE_DATA_API_KEY),
    market: "XAU/USD",
    note: "This endpoint reports configuration, not trading readiness."
  });
});

app.get("/api/price", async (_req, res) => {
  if (!process.env.TWELVE_DATA_API_KEY) {
    return res.status(503).json({
      error: "Live prices are not configured. Add TWELVE_DATA_API_KEY to your server .env file."
    });
  }
  try {
    const url = new URL("https://api.twelvedata.com/price");
    url.searchParams.set("symbol", "XAU/USD");
    url.searchParams.set("apikey", process.env.TWELVE_DATA_API_KEY);
    const upstream = await fetch(url);
    const data = await upstream.json();
    if (!upstream.ok || data.status === "error" || !data.price) {
      return res.status(502).json({ error: data.message || "Live price provider did not return a price." });
    }
    res.json({
      symbol: "XAU/USD",
      price: Number(data.price),
      source: "Twelve Data",
      retrievedAt: new Date().toISOString()
    });
  } catch (_err) {
    res.status(502).json({ error: "Could not retrieve a live price right now." });
  }
});

app.post("/api/analyze", upload.single("chart"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Choose a chart screenshot first." });
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({
      error: "AI screenshot analysis is not configured yet. Add OPENAI_API_KEY to your server .env file."
    });
  }

  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const imageData = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
  const instructions = `You are a cautious XAU/USD chart screenshot assistant, not an execution system.
Analyze only what is visibly supported by this image. Never invent prices, candles, indicators, or a timeframe.
Look for market structure (BOS/CHOCH), liquidity sweeps, order blocks, and fair value gaps if visible.
Return a JSON object with these keys:
{
 "symbol":"XAUUSD",
 "decision":"BUY"|"SELL"|"NO TRADE",
 "timeframe":"visible timeframe or Unknown",
 "entry":"price/zone only if legible, otherwise Not reliable from image",
 "stopLoss":"level only if defensible from visible structure, otherwise Not reliable from image",
 "takeProfit":"level only if defensible from visible prices and structure, otherwise Not reliable from image",
 "setup":["short list of observations"],
 "reasons":["short list of reasons"],
 "confidence":"Low"|"Medium"|"High",
 "missing":["what is not visible or must be verified"],
 "warning":"This is image-based analysis, not a guarantee."
}
Use NO TRADE if the screenshot is unclear, lacks legible price scale/current candles, or the setup is ambiguous.
Do not claim that an image alone proves the live market price. Keep the response concise.`;

  try {
    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        input: [{
          role: "user",
          content: [
            { type: "input_text", text: instructions },
            { type: "input_image", image_url: imageData, detail: "high" }
          ]
        }]
      })
    });
    const data = await upstream.json();
    if (!upstream.ok) {
      return res.status(502).json({ error: data.error?.message || "AI provider request failed." });
    }
    const outputText = (data.output || [])
      .flatMap(item => item.content || [])
      .filter(item => item.type === "output_text")
      .map(item => item.text)
      .join("\n");
    if (!outputText) return res.status(502).json({ error: "AI did not return an analysis." });

    let parsed;
    try {
      const clean = outputText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      parsed = JSON.parse(clean);
    } catch {
      parsed = {
        symbol: "XAUUSD", decision: "NO TRADE", timeframe: "Unknown",
        entry: "Not reliable from image", stopLoss: "Not reliable from image",
        takeProfit: "Not reliable from image", setup: [],
        reasons: [outputText.slice(0, 1500)], confidence: "Low",
        missing: ["Structured response could not be verified"],
        warning: "Review the chart manually. This is not a guaranteed signal."
      };
    }
    res.json({ analysis: parsed, analyzedAt: new Date().toISOString() });
  } catch (_err) {
    res.status(502).json({ error: "Could not complete the screenshot analysis." });
  }
});

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "Image is too large. Maximum size is 8 MB." });
  }
  res.status(400).json({ error: err.message || "Request could not be processed." });
});

app.listen(PORT, () => console.log(`BOT.XAU dashboard running at http://localhost:${PORT}`));
