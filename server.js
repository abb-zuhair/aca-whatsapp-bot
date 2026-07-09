/**
 * ACA School Policy WhatsApp Bot
 * ---------------------------------
 * Flow:
 *   1. Parent sends a WhatsApp message -> WATI receives it -> WATI calls our /webhook
 *   2. We score the question against small knowledge-base SECTIONS and pick only
 *      the relevant ones (keyword-based retrieval) instead of sending everything.
 *   3. We ask Claude to answer strictly from those sections.
 *   4. We send Claude's answer back to the parent using WATI's Send Message API.
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
const { SECTIONS, ALWAYS_INCLUDE_IDS } = require("./data/knowledge_base");

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

// Some WATI dashboards give you a token that already includes the word
// "Bearer " at the start. If we then add "Bearer " again when building the
// Authorization header, WATI rejects it with a 401. Strip it here just in case.
const CLEAN_WATI_TOKEN = (WATI_API_TOKEN || "").replace(/^Bearer\s+/i, "").trim();

const MAX_SECTIONS_PER_REQUEST = 4;

// --- Keyword-based retrieval ---
// No embeddings, no vector DB — just score each section by how many of its
// keywords appear in the question, and keep the top matches. This is what
// cuts token usage per query instead of always sending the whole knowledge base.
function retrieveRelevantSections(question) {
  const q = question.toLowerCase();

  const scored = SECTIONS.map((section) => {
    let score = 0;
    for (const kw of section.keywords) {
      if (q.includes(kw.toLowerCase())) score += 1;
    }
    return { section, score };
  });

  const matched = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SECTIONS_PER_REQUEST)
    .map((s) => s.section);

  // Always include a small safety-net section (e.g. contact info) so greetings
  // or vague questions still get something useful back.
  const alwaysOn = SECTIONS.filter(
    (s) => ALWAYS_INCLUDE_IDS.includes(s.id) && !matched.some((m) => m.id === s.id)
  );

  const selected = [...matched, ...alwaysOn];

  // Fallback: nothing matched at all (very generic/unclear message) — give the
  // model the most commonly-asked section (tuition) plus contact info rather
  // than nothing.
  if (matched.length === 0) {
    const fallback = SECTIONS.find((s) => s.id === "tuition_fees");
    if (fallback && !selected.some((s) => s.id === fallback.id)) selected.unshift(fallback);
  }

  return selected;
}

function buildSystemPrompt(sections) {
  const kbText = sections
    .map((s) => `\n--- ${s.title} ---\n${s.content}`)
    .join("\n");

  return `You are a helpful assistant for American Creativity Academy (ACA), a school in Kuwait
(campuses in Hawally and Salmiya). Parents message you on WhatsApp with questions about school
policy: tuition fees, payment installments, withdrawal rules, registration, kindergarten
requirements, attendance, and general conduct rules.

Answer ONLY using the information below. If the answer isn't covered, say clearly that you don't
have that information and suggest the parent contact the school directly (Hawally: 22673333,
Salmiya: 25731535, or www.aca.edu.kw) — do not guess or invent details, especially about money,
dates, or refunds.

Reply in the same language the parent used (English or Arabic). Write in clean plain text suited
for WhatsApp: no markdown symbols like ** or ### or --- dividers, no emoji headers. Use short
paragraphs and, if needed, simple dashes (-) for lists. Keep it concise and friendly.

RELEVANT POLICY INFORMATION:
${kbText}`;
}

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

  const relevantSections = retrieveRelevantSections(question);
  const systemPrompt = buildSystemPrompt(relevantSections);

  console.log(
    `[KB] Using sections: ${relevantSections.map((s) => s.id).join(", ")}`
  );

  const response = await axios.post(
    "https://api.anthropic.com/v1/messages",
    {
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      system: systemPrompt,
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

  // Claude's API returns exact token counts used for this request — log them
  // so you can see real usage per WhatsApp message without checking the
  // Anthropic console each time.
  const usage = response.data.usage;
  if (usage) {
    console.log(
      `[TOKENS] input: ${usage.input_tokens}, output: ${usage.output_tokens}, total: ${usage.input_tokens + usage.output_tokens}`
    );
  }

  history.push({ role: "assistant", content: answer });
  return answer;
}

async function sendWatiMessage(waId, messageText) {
  const url = `${WATI_BASE_URL}/api/v1/sendSessionMessage/${waId}`;
  await axios.post(url, null, {
    params: { messageText },
    headers: {
      Authorization: `Bearer ${CLEAN_WATI_TOKEN}`,
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
