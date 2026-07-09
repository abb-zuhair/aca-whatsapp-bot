/**
 * ACA School Policy WhatsApp Bot
 * ---------------------------------
 * Flow:
 *   1. Parent sends a WhatsApp message -> WATI receives it -> WATI calls our /webhook
 *   2. We take the question, build a prompt with our knowledge base as context,
 *      and ask Claude to answer strictly from that context.
 *   3. We send Claude's answer back to the parent using WATI's Send Message API.
 *
 * Required environment variables (see .env.example):
 *   ANTHROPIC_API_KEY   - your Anthropic API key
 *   WATI_BASE_URL        - e.g. https://live-server-XXXX.wati.io
 *   WATI_API_TOKEN       - the Bearer token from your WATI dashboard (Settings > API & Webhooks)
 *   PORT                 - optional, defaults to 3000
 */

require("dotenv").config();
const express = require("express");
const axios = require("axios");
const { KNOWLEDGE_BASE } = require("./data/knowledge_base");

const app = express();
app.use(express.json());

const {
  ANTHROPIC_API_KEY,
  WATI_BASE_URL,
  WATI_API_TOKEN,
  PORT = 3000,
} = process.env;

if (!ANTHROPIC_API_KEY) console.warn("[WARN] ANTHROPIC_API_KEY is not set.");
if (!WATI_BASE_URL) console.warn("[WARN] WATI_BASE_URL is not set.");
if (!WATI_API_TOKEN) console.warn("[WARN] WATI_API_TOKEN is not set.");

// Build the system prompt once — it bundles the entire knowledge base as context.
// (Small enough here that full-context is more reliable than a vector search step.)
function buildSystemPrompt() {
  const kbText = KNOWLEDGE_BASE.map(
    (doc) => `\n--- Source: ${doc.source} (${doc.language}) ---\n${doc.content}`
  ).join("\n");

  return `You are a helpful assistant for American Creativity Academy (ACA), a school in Kuwait
(campuses in Hawally and Salmiya). Parents will message you on WhatsApp with questions about
school policy: tuition fees, payment installments, withdrawal rules, registration, kindergarten
requirements, attendance, and general conduct rules.

Answer ONLY using the information in the KNOWLEDGE BASE below. If the answer is not in the
knowledge base, say clearly that you don't have that information and suggest the parent contact
the school directly (Hawally: 22673333, Salmiya: 25731535, or www.aca.edu.kw) — do not guess or
invent details, especially about money, dates, or refunds.

Reply in the same language the parent used (English or Arabic). Keep answers concise and friendly,
formatted for WhatsApp (short paragraphs, no heavy markdown). If useful, use simple bullet points
with "-".

KNOWLEDGE BASE:
${kbText}`;
}

const SYSTEM_PROMPT = buildSystemPrompt();

// Simple in-memory per-user conversation history (resets on server restart).
// For production, swap this for a database (e.g. Redis) keyed by WhatsApp number.
const conversations = new Map();
const MAX_HISTORY_MESSAGES = 10; // keep last 10 turns per user to control token usage

function getHistory(waId) {
  if (!conversations.has(waId)) conversations.set(waId, []);
  return conversations.get(waId);
}

async function askClaude(waId, question) {
  const history = getHistory(waId);
  history.push({ role: "user", content: question });

  const response = await axios.post(
    "https://api.anthropic.com/v1/messages",
    {
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: history.slice(-MAX_HISTORY_MESSAGES),
    },
    {
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
    }
  );

  const answer = response.data.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  history.push({ role: "assistant", content: answer });
  return answer;
}

async function sendWatiMessage(waId, messageText) {
  const url = `${WATI_BASE_URL}/api/v1/sendSessionMessage/${waId}`;
  await axios.post(url, null, {
    params: { messageText },
    headers: {
      Authorization: `Bearer ${WATI_API_TOKEN}`,
    },
  });
}

// --- WATI Webhook endpoint ---
// Configure this URL in WATI: Settings > API & Webhooks > Webhook URL
// e.g. https://your-app.up.railway.app/webhook
app.post("/webhook", async (req, res) => {
  try {
    const body = req.body;

    // WATI sends different payload shapes depending on event type / API version.
    // We defensively pull the sender's WhatsApp number and message text.
    const waId = body.waId || body.whatsappNumber || body.data?.waId;
    const text =
      body.text ||
      body.data?.text ||
      body.body?.text ||
      body.message?.text;

    // Ignore events that aren't inbound text messages (e.g. delivery/read receipts,
    // messages sent BY the school itself which WATI may also echo to the webhook).
    const isOutgoing = body.owner === true || body.eventType === "sentMessage";
    if (!waId || !text || isOutgoing) {
      return res.status(200).send("ignored");
    }

    console.log(`[IN] ${waId}: ${text}`);
    const answer = await askClaude(waId, text);
    console.log(`[OUT] ${waId}: ${answer}`);

    await sendWatiMessage(waId, answer);
    res.status(200).send("ok");
  } catch (err) {
    console.error("Webhook error:", err.response?.data || err.message);
    res.status(500).send("error");
  }
});

// Health check — useful for Railway/Render to confirm the app is alive
app.get("/", (req, res) => {
  res.send("ACA WhatsApp policy bot is running.");
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
