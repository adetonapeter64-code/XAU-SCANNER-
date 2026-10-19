# BOT.XAU Sniper Signal Scanner

A standalone web dashboard for XAU/USD chart screenshot analysis and optional live-price lookup. It does not use Telegram or send external messages.

## Requirements
- Node.js 18 or newer
- An OpenAI API key for screenshot analysis
- Optional Twelve Data API key for live XAU/USD price lookup

## Run locally
1. Extract the ZIP.
2. Open a terminal in the `bot-xau-sniper` folder.
3. Run `npm install`.
4. Copy `.env.example` to `.env`.
5. Add your API keys to `.env` (never paste them into public frontend code or commit `.env`).
6. Run `npm start`.
7. Open `http://localhost:3000`.

## Environment variables
- `OPENAI_API_KEY`: required for AI screenshot analysis.
- `TWELVE_DATA_API_KEY`: optional live price endpoint. Provider plan and symbol availability may vary.
- `OPENAI_MODEL`: optional model override; default is `gpt-4.1-mini`.
- `PORT`: optional server port.

## Important limitations
- This starter is a working scaffold, not a verified trading strategy or a guarantee of profitable signals.
- Screenshot analysis can misread small labels and cannot establish the current live price by itself.
- Live price lookup currently shows a quote only. It does not yet compute a fully validated live-market sniper setup from candles. That is a next development step requiring an OHLC/candlestick endpoint and explicit strategy rules.
- Signal history is stored in the browser's local storage, so it is local to that browser/device and can be cleared with browser data.
- Before public deployment, add authentication, request limits, upload hardening, logging, and secure environment variables.
- Never commit `.env` or expose API keys in client-side JavaScript.
