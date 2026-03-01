# Syra Signal Terminal

A clean, browser-based AI trading insight dashboard for Solana traders, built on top of the [Syra API](https://syraa.fun).

![Dashboard Preview](https://syraa.fun/og-image.png)

---

## What it does

Syra Signal Terminal lets traders enter any Solana token name (e.g. `solana`, `bitcoin`, `bonk`) and instantly receive AI-generated trading signals powered by the Syra API — including on-chain metrics, sentiment analysis, entry/exit recommendations, and more.

---

## Features

- **Live signal analysis** — calls `https://api.syraa.fun/signal` in real time
- **Full x402 payment protocol support** — automatically detects a `402 Payment Required` response, displays the payment instructions from the API, accepts the user's `PAYMENT-SIGNATURE` and `PAYMENT-TOKEN`, and retries the request with those headers
- **Demo mode** — fully functional UI preview with realistic mock data, no API key or payment needed
- **Clean terminal UI** — dark trading-terminal aesthetic, mobile-friendly, works in any modern browser
- **Zero dependencies** — plain HTML, CSS, and vanilla JavaScript, no frameworks or build tools

---

## How to run it

1. Download or clone this repository
2. Open `index.html` in any modern browser (Chrome, Firefox, Safari, Edge)
3. That's it — no install, no build step, no server needed

---

## How to use it

### Demo mode (no payment needed)
Click **⬡ RUN DEMO** to see the full UI with simulated signal data.

### Live mode (real API)
1. Type a token name in the input field, e.g. `solana`
2. Click **▶ ANALYZE SIGNAL**
3. The app will hit the Syra API — if payment is required (HTTP 402), a payment panel will appear automatically showing the instructions from the API
4. Complete the x402 payment (0.10 USDC on Solana or Base), then paste your `PAYMENT-SIGNATURE` and `PAYMENT-TOKEN` into the form
5. Click **⟳ RETRY WITH PAYMENT** — the dashboard will display your AI trading signal

---

## x402 Payment Protocol

This dashboard implements the [x402 payment protocol](https://docs.syraa.fun) used by the Syra API:

| Step | What happens |
|------|-------------|
| 1 | App sends `GET /signal?token=solana` |
| 2 | API responds with `HTTP 402` + payment instructions |
| 3 | Dashboard displays the payment details to the user |
| 4 | User completes payment and receives credentials |
| 5 | App retries the request with `PAYMENT-SIGNATURE` and `PAYMENT-TOKEN` headers |
| 6 | API responds with the full AI signal |

---

## Project structure

```
index.html   — UI layout and markup
style.css    — Styling (dark terminal theme, fully responsive)
script.js    — All JavaScript logic (API calls, x402 flow, state management)
README.md    — This file
```

---

## Syra Resources

| Resource | Link |
|----------|------|
| Product | [syraa.fun](https://syraa.fun) |
| Docs | [docs.syraa.fun](https://docs.syraa.fun) |
| Playground | [playground.syraa.fun](https://playground.syraa.fun) |
| Agent | [agent.syraa.fun](https://agent.syraa.fun) |
| API endpoint | `https://api.syraa.fun/signal` |

---

## Built for the Syra AI Bounty

This dashboard was submitted as an **Integration** contribution for the Syra AI open-source bounty. It demonstrates real-world usage of the Syra API with the x402 payment protocol in a complete, usable product.
