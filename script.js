/* ════════════════════════════════════════════════════════════
   SYRA SIGNAL TERMINAL — script.js
   ════════════════════════════════════════════════════════════

   QUICK START:
   ─────────────────────────────────────────────────────────
   1. The API endpoint is already set to https://api.syraa.fun/signal
   2. If the API requires an API key, set API_KEY below.
   3. The x402 payment flow is handled automatically:
        • First request → 402? → payment panel appears
        • User pastes PAYMENT-SIGNATURE + PAYMENT-TOKEN
        • Clicks "Retry" → request is sent again with headers
   4. Use "RUN DEMO" to test the UI without any API key.
   ════════════════════════════════════════════════════════════ */


// ─────────────────────────────────────────────────────────────
// 1. CONFIGURATION
// ─────────────────────────────────────────────────────────────

const API_ENDPOINT = 'https://api.syraa.fun/signal';

// Optional: If the Syra API also requires a static API key
// in addition to x402, add it here. Leave blank if not needed.
const API_KEY = '';   // e.g. 'sk-...'


// ─────────────────────────────────────────────────────────────
// 2. DOM REFERENCES
// ─────────────────────────────────────────────────────────────

// Left panel — input & controls
const tokenInput     = document.getElementById('tokenInput');
const analyzeBtn     = document.getElementById('analyzeBtn');
const demoBtn        = document.getElementById('demoBtn');

// x402 payment panel
const paymentSection = document.getElementById('paymentSection');
const paymentInfo    = document.getElementById('paymentInfo');
const sigInput       = document.getElementById('sigInput');
const tokenPayInput  = document.getElementById('tokenPayInput');
const retryBtn       = document.getElementById('retryBtn');

// Right panel — state views
const idleState      = document.getElementById('idleState');
const loadingState   = document.getElementById('loadingState');
const errorState     = document.getElementById('errorState');
const errorBody      = document.getElementById('errorBody');
const resultsState   = document.getElementById('resultsState');

// Results content
const resultBadge    = document.getElementById('resultBadge');
const resultTime     = document.getElementById('resultTime');
const signalMetrics  = document.getElementById('signalMetrics');
const mSignal        = document.getElementById('mSignal');
const mConfidence    = document.getElementById('mConfidence');
const mAction        = document.getElementById('mAction');
const resultBody     = document.getElementById('resultBody');
const demoBadge      = document.getElementById('demoBadge');

// Status-bar clock
const clockEl        = document.getElementById('clock');


// ─────────────────────────────────────────────────────────────
// 3. LIVE CLOCK (top status bar)
// ─────────────────────────────────────────────────────────────

function updateClock() {
  const now = new Date();
  clockEl.textContent = now.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }) + ' UTC';
}
updateClock();
setInterval(updateClock, 1000);   // refresh every second


// ─────────────────────────────────────────────────────────────
// 4. EVENT LISTENERS
// ─────────────────────────────────────────────────────────────

// Analyze button → start the real API call flow
analyzeBtn.addEventListener('click', () => startAnalysis());

// Also trigger on Enter key while typing in the input
tokenInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') startAnalysis();
});

// Demo button → show mock data without touching the API
demoBtn.addEventListener('click', runDemo);

// Retry button → re-run the API call with payment headers attached
retryBtn.addEventListener('click', retryWithPayment);


// ─────────────────────────────────────────────────────────────
// 5. MAIN FLOW — startAnalysis()
//    Called when the user clicks Analyze.
// ─────────────────────────────────────────────────────────────

async function startAnalysis() {
  const token = tokenInput.value.trim().toUpperCase();

  // Basic validation
  if (!token) {
    tokenInput.focus();
    tokenInput.style.borderColor = 'var(--red)';
    setTimeout(() => { tokenInput.style.borderColor = ''; }, 1200);
    return;
  }

  // Hide the payment panel in case it was visible from a previous attempt
  paymentSection.hidden = true;

  // Show the loading spinner in the right panel
  showState('loading');
  setButtonLoading(analyzeBtn, true);

  try {
    // Build request headers (no payment headers yet)
    const headers = buildHeaders();

    // First API call
    const response = await callAPI(token, headers);

    if (response.status === 402) {
      // x402: Payment required — show the payment form
      await handle402(response);

    } else if (!response.ok) {
      // Other HTTP error
      const errText = await parseErrorText(response);
      throw new Error(`[${response.status}] ${errText}`);

    } else {
      // Success — display the results
      const data = await response.json();
      displayResults(token, data, false);
    }

  } catch (err) {
    // Network failure, JSON parse error, etc.
    showError(err.message || 'Network error — check your connection and try again.');

  } finally {
    setButtonLoading(analyzeBtn, false);
  }
}


// ─────────────────────────────────────────────────────────────
// 6. RETRY WITH PAYMENT
//    Called when the user fills in the x402 credentials and
//    clicks "Retry with Payment".
// ─────────────────────────────────────────────────────────────

async function retryWithPayment() {
  const sig        = sigInput.value.trim();
  const payToken   = tokenPayInput.value.trim();

  if (!sig || !payToken) {
    alert('Please enter both PAYMENT-SIGNATURE and PAYMENT-TOKEN before retrying.');
    return;
  }

  const ticker = tokenInput.value.trim().toUpperCase();

  showState('loading');
  setButtonLoading(retryBtn, true);

  try {
    // Build headers INCLUDING the payment credentials
    const headers = buildHeaders({
      'PAYMENT-SIGNATURE': sig,
      'PAYMENT-TOKEN':     payToken,
    });

    const response = await callAPI(ticker, headers);

    if (response.status === 402) {
      // Still getting 402 — credentials may be wrong
      const errData = await safeParseJSON(response);
      showError(
        'Payment was rejected by the server.\n\n' +
        (errData?.message || 'Please double-check your PAYMENT-SIGNATURE and PAYMENT-TOKEN.')
      );

    } else if (!response.ok) {
      const errText = await parseErrorText(response);
      throw new Error(`[${response.status}] ${errText}`);

    } else {
      const data = await response.json();
      paymentSection.hidden = true;  // hide payment panel on success
      displayResults(ticker, data, false);
    }

  } catch (err) {
    showError(err.message || 'Request failed after payment. Please try again.');

  } finally {
    setButtonLoading(retryBtn, false);
  }
}


// ─────────────────────────────────────────────────────────────
// 7. API HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Sends a GET request to the Syra /signal endpoint.
 * The token name is passed as a query parameter: ?token=solana
 *
 * @param {string} ticker  - Token symbol entered by user, e.g. "SOL"
 * @param {object} headers - HTTP headers object
 * @returns {Promise<Response>}
 */
async function callAPI(ticker, headers) {
  // Convert to lowercase because the API expects full names like "solana", "bitcoin"
  const url = `${API_ENDPOINT}?token=${encodeURIComponent(ticker.toLowerCase())}`;

  return fetch(url, {
    method: 'GET',
    headers,
  });
}

/**
 * Builds the headers object for each request.
 * Pass extra headers (e.g. payment headers) as additionalHeaders.
 *
 * @param {object} [additionalHeaders={}]
 * @returns {object}
 */
function buildHeaders(additionalHeaders = {}) {
  // No Content-Type needed for GET requests
  const headers = { ...additionalHeaders };

  // If you have a static API key, it gets attached here
  if (API_KEY) {
    headers['Authorization'] = `Bearer ${API_KEY}`;
  }

  return headers;
}

/**
 * Handles a 402 Payment Required response.
 * Extracts the payment instructions from the response body
 * and reveals the payment form on the left panel.
 *
 * @param {Response} response - The 402 fetch Response object
 */
async function handle402(response) {
  // Try to read payment instructions from the response body
  const data = await safeParseJSON(response);

  // Build a human-readable string from whatever the server sent
  let infoText = '';
  if (data) {
    infoText =
      data.paymentRequired  ||
      data.payment_required ||
      data.instructions     ||
      data.message          ||
      JSON.stringify(data, null, 2);   // fallback: show the raw JSON
  } else {
    infoText = 'Payment required. Please provide your PAYMENT-SIGNATURE and PAYMENT-TOKEN below.';
  }

  // Populate and reveal the payment panel
  paymentInfo.textContent = infoText;
  paymentSection.hidden   = false;

  // Go back to idle (not error) — user needs to fill in payment details
  showState('idle');

  // Scroll payment section into view on mobile
  paymentSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/**
 * Safely parses JSON from a Response without throwing.
 * Returns null if parsing fails.
 *
 * @param {Response} response
 * @returns {Promise<object|null>}
 */
async function safeParseJSON(response) {
  try {
    return await response.json();
  } catch (_) {
    return null;
  }
}

/**
 * Extracts a readable error string from a non-ok Response.
 *
 * @param {Response} response
 * @returns {Promise<string>}
 */
async function parseErrorText(response) {
  const data = await safeParseJSON(response);
  return (
    data?.message ||
    data?.error   ||
    data?.detail  ||
    response.statusText ||
    'Unknown error'
  );
}


// ─────────────────────────────────────────────────────────────
// 8. DISPLAY RESULTS
//    Populates the right panel with the AI signal data.
// ─────────────────────────────────────────────────────────────

/**
 * @param {string}  ticker - Token symbol
 * @param {object}  data   - Parsed API response (or mock data)
 * @param {boolean} isDemo - Whether this is a demo run
 */
function displayResults(ticker, data, isDemo) {
  // Token badge (top of results panel)
  resultBadge.textContent = ticker;

  // Timestamp
  resultTime.textContent = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });

  // Show or hide the DEMO badge
  demoBadge.hidden = !isDemo;

  // ── Structured metrics ────────────────────────────────────
  // These three cards (SIGNAL / CONFIDENCE / ACTION) only appear
  // if the API returns those fields. They're hidden otherwise.
  const signal     = data.signal     || data.Signal     || null;
  const confidence = data.confidence || data.Confidence || null;
  const action     = data.action     || data.Action     || null;

  if (signal || confidence || action) {
    mSignal.textContent     = signal     || '—';
    mConfidence.textContent = confidence || '—';
    mAction.textContent     = action     || '—';

    colourMetric(mSignal,     signal);
    colourMetric(mAction,     action);
    colourMetric(mConfidence, null);

    signalMetrics.hidden = false;
  } else {
    signalMetrics.hidden = true;
  }

  // ── Raw text output ───────────────────────────────────────
  // Tries common field names in order. If none match,
  // the entire response is pretty-printed as JSON so
  // you can see exactly what the API returned.
  const rawText =
    data.analysis ||
    data.insight  ||
    data.result   ||
    data.content  ||
    data.text     ||
    data.message  ||
    JSON.stringify(data, null, 2);

  resultBody.textContent = rawText;

  // Reveal the results panel
  showState('results');
}

/**
 * Applies a colour class to a metric value element.
 * BUY → green, SELL → red, HOLD → amber, STRONG BUY → bright green
 *
 * @param {HTMLElement} el
 * @param {string|null} value
 */
function colourMetric(el, value) {
  el.classList.remove('buy', 'sell', 'hold', 'strong');
  if (!value) return;
  const v = value.toUpperCase();
  if (v.includes('BUY'))  el.classList.add(v.includes('STRONG') ? 'strong' : 'buy');
  if (v.includes('SELL')) el.classList.add('sell');
  if (v.includes('HOLD')) el.classList.add('hold');
}


// ─────────────────────────────────────────────────────────────
// 9. DEMO MODE
//    Shows realistic mock data so you can test the full UI
//    without an API key or payment.
// ─────────────────────────────────────────────────────────────

function runDemo() {
  const ticker = tokenInput.value.trim().toUpperCase() || 'SOL';

  showState('loading');

  // Simulate a short network delay so the loading animation is visible
  setTimeout(() => {
    const mockData = generateMockSignal(ticker);
    displayResults(ticker, mockData, true);   // isDemo = true
  }, 1800);
}

/**
 * Generates a plausible mock signal response for the given token.
 *
 * @param {string} ticker
 * @returns {object}
 */
function generateMockSignal(ticker) {
  const signals = ['BUY', 'SELL', 'HOLD', 'STRONG BUY'];
  const picked  = signals[Math.floor(Math.random() * signals.length)];
  const conf    = (65 + Math.floor(Math.random() * 30)) + '%';

  return {
    signal:     picked,
    confidence: conf,
    action:     picked,
    analysis:
`═══════════════════════════════════════════
  SYRA SIGNAL REPORT  ·  TOKEN: ${ticker}
  Generated: ${new Date().toUTCString()}
  Mode: DEMO (simulated data)
═══════════════════════════════════════════

SIGNAL SUMMARY
──────────────
Signal:      ${picked}
Confidence:  ${conf}
Timeframe:   4H / 1D composite

ON-CHAIN METRICS
────────────────
• Wallet accumulation (24h):   +12.4%
• Large-wallet net flow:       INFLOW
• DEX volume spike:            +38% vs 7-day avg
• Holder distribution:         Increasing (bullish)
• Smart-money activity:        Detected (3 wallets)

TECHNICAL INDICATORS
────────────────────
• RSI (14):         58.4  — Neutral/Bullish
• MACD:             Crossover signal detected
• Bollinger Bands:  Price near mid-band, upward bias
• Volume Profile:   High value zone: $${(Math.random() * 200 + 20).toFixed(2)}

SENTIMENT ANALYSIS
──────────────────
• Social mention velocity:  +22% (rising)
• Fear & Greed Index:       61 — Greed
• News sentiment:           Positive (0.72 score)

RISK ASSESSMENT
───────────────
• Volatility (30d):  Medium
• Liquidity depth:   Adequate
• Rug/exploit risk:  Low

RECOMMENDATION
──────────────
${picked === 'BUY' || picked === 'STRONG BUY'
  ? `Consider entering a position with defined risk.\nSet stop-loss at recent support level.\nMonitor on-chain flow for continuation.`
  : picked === 'SELL'
  ? `Consider reducing exposure or taking profit.\nWatch for bounce at key support.\nRe-evaluate if volume confirms reversal.`
  : `Hold current position.\nNo strong directional bias detected.\nWait for clearer setup before adding.`
}

───────────────────────────────────────────
⚠  This is DEMO DATA for UI testing only.
   Connect to the Syra API for live signals.
───────────────────────────────────────────`,
  };
}


// ─────────────────────────────────────────────────────────────
// 10. UI STATE MANAGEMENT
// ─────────────────────────────────────────────────────────────

/**
 * Shows exactly one of the four right-panel states,
 * hiding all the others.
 *
 * @param {'idle'|'loading'|'error'|'results'} state
 */
function showState(state) {
  idleState.hidden    = state !== 'idle';
  loadingState.hidden = state !== 'loading';
  errorState.hidden   = state !== 'error';
  resultsState.hidden = state !== 'results';
}

/**
 * Reveals the error state and fills in the message.
 * @param {string} message
 */
function showError(message) {
  errorBody.textContent = message;
  showState('error');
}

/**
 * Toggles the loading animation on any button.
 * @param {HTMLButtonElement} btn
 * @param {boolean} isLoading
 */
function setButtonLoading(btn, isLoading) {
  if (isLoading) {
    btn.classList.add('loading');
    btn.disabled = true;
  } else {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}


// ─────────────────────────────────────────────────────────────
// 11. INITIALISE
// ─────────────────────────────────────────────────────────────

// Show idle state on first load
showState('idle');

// Auto-focus the input field for convenience
tokenInput.focus();
