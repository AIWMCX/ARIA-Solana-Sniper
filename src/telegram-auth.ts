import crypto from "node:crypto";
import { CONFIG } from "./config.js";

/**
 * Telegram Mini App initData verification.
 *
 * When a user opens the Mini App, Telegram injects a signed `initData` string
 * into window.Telegram.WebApp.initData. We send this to the server with every
 * form submission and verify the HMAC here.
 *
 * If verification passes, the `user` field is GUARANTEED by Telegram to be
 * the real authenticated user — no spoofing possible.
 *
 * Docs: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */

export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

export interface VerifiedInitData {
  user: TelegramUser;
  auth_date: number;
  query_id?: string;
}

const BOT_TOKEN = CONFIG.TELEGRAM_BOT_TOKEN;

// Pre-compute the secret key per Telegram's spec:
//   secret_key = HMAC_SHA256(key="WebAppData", message=bot_token)
const secretKey = crypto
  .createHmac("sha256", "WebAppData")
  .update(BOT_TOKEN)
  .digest();

const MAX_AGE_SECONDS = 60 * 60 * 24; // 24h — reject stale initData

export function verifyInitData(initData: string): VerifiedInitData | null {
  if (!initData || typeof initData !== "string") return null;

  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash");
  if (!receivedHash) return null;
  params.delete("hash");

  // Build data-check-string: sorted key=value pairs joined by \n
  const pairs: string[] = [];
  for (const key of Array.from(params.keys()).sort()) {
    pairs.push(`${key}=${params.get(key)}`);
  }
  const dataCheckString = pairs.join("\n");

  const computedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  // Constant-time compare
  if (
    computedHash.length !== receivedHash.length ||
    !crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(receivedHash))
  ) {
    return null;
  }

  // Age check
  const authDate = Number(params.get("auth_date"));
  if (!Number.isFinite(authDate)) return null;
  const ageSec = Math.floor(Date.now() / 1000) - authDate;
  if (ageSec > MAX_AGE_SECONDS) return null;

  // Parse user
  const userJson = params.get("user");
  if (!userJson) return null;
  let user: TelegramUser;
  try {
    user = JSON.parse(userJson);
  } catch {
    return null;
  }
  if (!user.id || typeof user.id !== "number") return null;

  return {
    user,
    auth_date: authDate,
    query_id: params.get("query_id") ?? undefined,
  };
}
