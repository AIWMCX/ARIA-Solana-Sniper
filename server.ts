import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { z } from "zod";
import { CONFIG } from "./config.js";
import { logger } from "./logger.js";
import { verifyInitData } from "./telegram-auth.js";
import { saveLead, markEmailed, recentSubmissionsByUser, totalLeads } from "./leads.js";
import { sendAdminNotification, sendUserConfirmation } from "./email.js";
import { notifyAdminOfLead } from "./bot.js";

const app = new Hono();

// ── Schemas ──────────────────────────────────────────────────────────────────
// Solana addresses are base58 (no 0,O,I,l), 32–44 chars. We're permissive on
// the upper bound but reject obvious garbage.
const SolanaAddress = z
  .string()
  .trim()
  .min(32, "wallet address too short")
  .max(44, "wallet address too long")
  .regex(/^[1-9A-HJ-NP-Za-km-z]+$/, "wallet must be base58 (Solana format)");

const SubmitBody = z.object({
  initData: z.string().min(10, "initData missing — open this via the Telegram bot"),
  name: z.string().trim().min(2, "name too short").max(100, "name too long"),
  email: z.string().trim().toLowerCase().email("invalid email"),
  wallet: SolanaAddress,
  interest: z.string().trim().max(500).optional(),
});

// ── Routes ───────────────────────────────────────────────────────────────────
app.get("/healthz", (c) => c.json({ ok: true, uptime: process.uptime(), leads: totalLeads() }));

// Form submission from inside the Mini App.
app.post("/api/submit", async (c) => {
  const ua = c.req.header("user-agent") ?? "";
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: "invalid JSON" }, 400);
  }

  const parsed = SubmitBody.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "invalid input" },
      400,
    );
  }

  // CRITICAL: verify the Telegram initData HMAC. Without this, anyone could
  // POST anything to this endpoint. With it, the `user` field is guaranteed.
  const verified = verifyInitData(parsed.data.initData);
  if (!verified) {
    logger.warn({ ua }, "submit rejected — bad initData");
    return c.json(
      { ok: false, error: "Telegram verification failed. Open via the bot, not directly." },
      401,
    );
  }

  // Rate limit per Telegram user: 3 submissions per hour
  const recent = recentSubmissionsByUser(verified.user.id);
  if (recent >= 3) {
    return c.json(
      { ok: false, error: "Too many submissions. Please try again later." },
      429,
    );
  }

  const lead = {
    tg_user_id: verified.user.id,
    tg_username: verified.user.username,
    tg_first_name: verified.user.first_name,
    tg_last_name: verified.user.last_name,
    name: parsed.data.name,
    email: parsed.data.email,
    wallet: parsed.data.wallet,
    interest: parsed.data.interest,
    user_agent: ua.slice(0, 200),
  };

  const leadId = saveLead(lead);
  logger.info({ leadId, tg: verified.user.id, email: lead.email }, "lead saved");

  // Fire-and-forget side effects — don't block the response
  void (async () => {
    const ok = await sendAdminNotification(lead, leadId);
    if (ok) markEmailed(leadId);
    await sendUserConfirmation(lead);
    await notifyAdminOfLead({
      leadId,
      name: lead.name,
      email: lead.email,
      wallet: lead.wallet,
      tgUsername: lead.tg_username,
      tgUserId: lead.tg_user_id,
    });
  })();

  return c.json({ ok: true, leadId });
});

// Serve the Mini App static files (./public/*)
app.use("/*", serveStatic({ root: "./public" }));

// SPA fallback → index.html
app.get("*", serveStatic({ path: "./public/index.html" }));

export function startServer(): void {
  serve({ fetch: app.fetch, port: CONFIG.PORT, hostname: "0.0.0.0" }, (info) => {
    logger.info({ port: info.port, publicUrl: CONFIG.PUBLIC_URL }, "http server listening");
  });
}
