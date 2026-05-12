import { Bot, InlineKeyboard } from "grammy";
import { CONFIG } from "./config.js";
import { logger } from "./logger.js";
import { totalLeads } from "./leads.js";

export const bot = new Bot(CONFIG.TELEGRAM_BOT_TOKEN);

const TERMINAL_URL = `${CONFIG.PUBLIC_URL}/`;

// ── /start: send the welcome + Mini App launch button ────────────────────────
bot.command("start", async (ctx) => {
  const firstName = ctx.from?.first_name ?? "trader";
  const keyboard = new InlineKeyboard().webApp("🟢 OPEN TERMINAL", TERMINAL_URL);

  await ctx.reply(
    [
      `*ARIA · Solana Sniper Terminal*`,
      ``,
      `Hi ${escapeMarkdown(firstName)} — tap below to open the live terminal.`,
      ``,
      `You'll see real-time detection, safety filtering, and trade execution`,
      `from the ARIA sniper running on Solana mainnet.`,
      ``,
      `To request access, fill the form inside the terminal:`,
      `  · name`,
      `  · email`,
      `  · Solana wallet address`,
      ``,
      `_Burner wallets only. Never share your main wallet._`,
    ].join("\n"),
    { parse_mode: "Markdown", reply_markup: keyboard },
  );
});

// ── /help ────────────────────────────────────────────────────────────────────
bot.command("help", async (ctx) => {
  const keyboard = new InlineKeyboard().webApp("OPEN TERMINAL", TERMINAL_URL);
  await ctx.reply(
    [
      `Commands:`,
      `  /start  — open the terminal`,
      `  /help   — this message`,
      ``,
      `Tap below to launch:`,
    ].join("\n"),
    { reply_markup: keyboard },
  );
});

// ── Admin-only: /stats ───────────────────────────────────────────────────────
bot.command("stats", async (ctx) => {
  if (!isAdmin(ctx.from?.id)) return;
  const n = totalLeads();
  await ctx.reply(`📊 Total leads captured: *${n}*`, { parse_mode: "Markdown" });
});

// ── Fallback ─────────────────────────────────────────────────────────────────
bot.on("message", async (ctx) => {
  if (ctx.message.text?.startsWith("/")) return; // unknown command
  const keyboard = new InlineKeyboard().webApp("OPEN TERMINAL", TERMINAL_URL);
  await ctx.reply("Open the terminal to request access:", { reply_markup: keyboard });
});

bot.catch((err) => {
  logger.error({ err: err.error, update: err.ctx.update.update_id }, "bot error");
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function isAdmin(userId: number | undefined): boolean {
  if (!userId || !CONFIG.ADMIN_TELEGRAM_CHAT_ID) return false;
  return String(userId) === CONFIG.ADMIN_TELEGRAM_CHAT_ID;
}

function escapeMarkdown(s: string): string {
  return s.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}

/** Push a DM to the admin when a new lead arrives — fallback to email. */
export async function notifyAdminOfLead(opts: {
  leadId: number;
  name: string;
  email: string;
  wallet: string;
  tgUsername?: string;
  tgUserId: number;
}): Promise<void> {
  if (!CONFIG.ADMIN_TELEGRAM_CHAT_ID) return;
  const tgLink = opts.tgUsername
    ? `[@${opts.tgUsername}](https://t.me/${opts.tgUsername})`
    : `id:${opts.tgUserId}`;
  const text = [
    `🎯 *New ARIA Lead* \`#${opts.leadId}\``,
    ``,
    `*Name:* ${escapeMarkdown(opts.name)}`,
    `*Email:* \`${escapeMarkdown(opts.email)}\``,
    `*Wallet:* \`${escapeMarkdown(opts.wallet)}\``,
    `*From:* ${tgLink}`,
  ].join("\n");
  try {
    await bot.api.sendMessage(CONFIG.ADMIN_TELEGRAM_CHAT_ID, text, {
      parse_mode: "Markdown",
      link_preview_options: { is_disabled: true },
    });
  } catch (err) {
    logger.warn({ err }, "admin DM notify failed (non-fatal)");
  }
}
