import "dotenv/config";
import { z } from "zod";

const Env = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(20, "TELEGRAM_BOT_TOKEN required (get from @BotFather)"),
  ADMIN_TELEGRAM_USERNAME: z.string().optional().default(""),
  ADMIN_TELEGRAM_CHAT_ID: z.string().optional().default(""),
  PUBLIC_URL: z.string().url("PUBLIC_URL must be a full https:// URL"),

  RESEND_API_KEY: z.string().min(10, "RESEND_API_KEY required (get from resend.com)"),
  ADMIN_EMAIL: z.string().email("ADMIN_EMAIL must be a valid email"),
  FROM_EMAIL: z.string().email().default("onboarding@resend.dev"),

  PORT: z.coerce.number().int().positive().default(8080),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
  DB_PATH: z.string().default("./data/leads.db"),
});

const parsed = Env.safeParse(process.env);
if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  for (const issue of parsed.error.issues) {
    console.error(`  • ${issue.path.join(".")}: ${issue.message}`);
  }
  console.error("\nCopy .env.example to .env and fill in the values.");
  process.exit(1);
}

export const CONFIG = parsed.data;

// PUBLIC_URL must not have a trailing slash — we concat paths to it.
if (CONFIG.PUBLIC_URL.endsWith("/")) {
  (CONFIG as any).PUBLIC_URL = CONFIG.PUBLIC_URL.replace(/\/+$/, "");
}
