import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { CONFIG } from "./config.js";
import { logger } from "./logger.js";

// Ensure directory exists
const dir = path.dirname(CONFIG.DB_PATH);
if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(CONFIG.DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    tg_user_id      INTEGER NOT NULL,
    tg_username     TEXT,
    tg_first_name   TEXT,
    tg_last_name    TEXT,
    name            TEXT NOT NULL,
    email           TEXT NOT NULL,
    wallet          TEXT NOT NULL,
    interest        TEXT,
    user_agent      TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    email_sent      INTEGER NOT NULL DEFAULT 0,
    email_sent_at   TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_leads_tg_user_id ON leads(tg_user_id);
  CREATE INDEX IF NOT EXISTS idx_leads_email      ON leads(email);
  CREATE INDEX IF NOT EXISTS idx_leads_created    ON leads(created_at DESC);
`);

logger.info({ path: CONFIG.DB_PATH }, "SQLite ready");

export interface Lead {
  tg_user_id: number;
  tg_username?: string;
  tg_first_name?: string;
  tg_last_name?: string;
  name: string;
  email: string;
  wallet: string;
  interest?: string;
  user_agent?: string;
}

const insertStmt = db.prepare(`
  INSERT INTO leads
    (tg_user_id, tg_username, tg_first_name, tg_last_name, name, email, wallet, interest, user_agent)
  VALUES
    (@tg_user_id, @tg_username, @tg_first_name, @tg_last_name, @name, @email, @wallet, @interest, @user_agent)
`);

const markEmailedStmt = db.prepare(`
  UPDATE leads SET email_sent = 1, email_sent_at = datetime('now') WHERE id = ?
`);

const countByUserStmt = db.prepare(`
  SELECT COUNT(*) as n FROM leads WHERE tg_user_id = ? AND created_at > datetime('now','-1 hour')
`);

const countAllStmt = db.prepare(`SELECT COUNT(*) as n FROM leads`);

export function saveLead(lead: Lead): number {
  const result = insertStmt.run({
    tg_user_id: lead.tg_user_id,
    tg_username: lead.tg_username ?? null,
    tg_first_name: lead.tg_first_name ?? null,
    tg_last_name: lead.tg_last_name ?? null,
    name: lead.name,
    email: lead.email,
    wallet: lead.wallet,
    interest: lead.interest ?? null,
    user_agent: lead.user_agent ?? null,
  });
  return result.lastInsertRowid as number;
}

export function markEmailed(id: number): void {
  markEmailedStmt.run(id);
}

/** Anti-spam: how many leads has this Telegram user submitted in the last hour? */
export function recentSubmissionsByUser(tgUserId: number): number {
  const row = countByUserStmt.get(tgUserId) as { n: number };
  return row.n;
}

export function totalLeads(): number {
  const row = countAllStmt.get() as { n: number };
  return row.n;
}

export { db };
