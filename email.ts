import { Resend } from "resend";
import { CONFIG } from "./config.js";
import { logger } from "./logger.js";
import type { Lead } from "./leads.js";

const resend = new Resend(CONFIG.RESEND_API_KEY);

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Email the admin (you) with the new lead — fires the moment a form is submitted. */
export async function sendAdminNotification(lead: Lead, leadId: number): Promise<boolean> {
  const tg = lead.tg_username ? `@${lead.tg_username}` : `id:${lead.tg_user_id}`;
  const subject = `🎯 ARIA Lead #${leadId} — ${lead.name} (${tg})`;

  const html = `
<!doctype html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#0a0c0d; color:#e7ecef; margin:0; padding:24px;">
  <div style="max-width:560px; margin:0 auto; background:#11151a; border:1px solid #1f2630; border-radius:6px; overflow:hidden;">
    <div style="padding:18px 22px; border-bottom:1px solid #1f2630; background:#161b22;">
      <div style="font-size:11px; letter-spacing:0.3em; color:#8a9199; text-transform:uppercase;">ARIA · NEW LEAD</div>
      <div style="font-size:20px; margin-top:4px; color:#b6ff3c;">Lead #${leadId}</div>
    </div>
    <table style="width:100%; border-collapse:collapse; font-size:14px;">
      <tr><td style="padding:10px 22px; color:#8a9199; width:120px;">Name</td><td style="padding:10px 22px; color:#e7ecef;">${escapeHtml(lead.name)}</td></tr>
      <tr><td style="padding:10px 22px; color:#8a9199;">Email</td><td style="padding:10px 22px;"><a href="mailto:${escapeHtml(lead.email)}" style="color:#6cc4ff;">${escapeHtml(lead.email)}</a></td></tr>
      <tr><td style="padding:10px 22px; color:#8a9199;">Wallet</td><td style="padding:10px 22px; font-family:monospace; color:#e7ecef; word-break:break-all;">${escapeHtml(lead.wallet)}</td></tr>
      <tr><td style="padding:10px 22px; color:#8a9199;">Telegram</td><td style="padding:10px 22px;">
        ${lead.tg_username ? `<a href="https://t.me/${escapeHtml(lead.tg_username)}" style="color:#6cc4ff;">@${escapeHtml(lead.tg_username)}</a>` : `id: ${lead.tg_user_id}`}
        ${lead.tg_first_name ? `<span style="color:#8a9199;"> · ${escapeHtml(lead.tg_first_name)} ${escapeHtml(lead.tg_last_name ?? "")}</span>` : ""}
      </td></tr>
      ${lead.interest ? `<tr><td style="padding:10px 22px; color:#8a9199;">Interest</td><td style="padding:10px 22px; color:#e7ecef;">${escapeHtml(lead.interest)}</td></tr>` : ""}
    </table>
    <div style="padding:14px 22px; border-top:1px solid #1f2630; color:#5a626c; font-size:11px;">
      Submitted ${new Date().toUTCString()} · Verified via Telegram initData HMAC
    </div>
  </div>
</body></html>`;

  const text = [
    `New ARIA lead #${leadId}`,
    `Name:     ${lead.name}`,
    `Email:    ${lead.email}`,
    `Wallet:   ${lead.wallet}`,
    `Telegram: ${lead.tg_username ? "@" + lead.tg_username : "id:" + lead.tg_user_id}`,
    lead.interest ? `Interest: ${lead.interest}` : "",
    "",
    `Submitted ${new Date().toUTCString()}`,
  ].filter(Boolean).join("\n");

  try {
    const { data, error } = await resend.emails.send({
      from: `ARIA Terminal <${CONFIG.FROM_EMAIL}>`,
      to: [CONFIG.ADMIN_EMAIL],
      replyTo: lead.email,
      subject,
      html,
      text,
    });
    if (error) {
      logger.error({ err: error, leadId }, "admin email failed");
      return false;
    }
    logger.info({ leadId, resendId: data?.id }, "admin email sent");
    return true;
  } catch (err) {
    logger.error({ err, leadId }, "admin email threw");
    return false;
  }
}

/** Optional: send the prospect a confirmation. */
export async function sendUserConfirmation(lead: Lead): Promise<boolean> {
  const html = `
<!doctype html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#0a0c0d; color:#e7ecef; margin:0; padding:24px;">
  <div style="max-width:560px; margin:0 auto; background:#11151a; border:1px solid #1f2630; border-radius:6px; overflow:hidden;">
    <div style="padding:22px; border-bottom:1px solid #1f2630;">
      <div style="font-size:11px; letter-spacing:0.3em; color:#8a9199; text-transform:uppercase;">ARIA · TERMINAL</div>
      <div style="font-size:22px; margin-top:6px; color:#b6ff3c;">Request received</div>
    </div>
    <div style="padding:22px; line-height:1.6; color:#e7ecef; font-size:14px;">
      <p>Hi ${escapeHtml(lead.name.split(" ")[0] ?? lead.name)},</p>
      <p>We've received your request for access to the ARIA Solana Sniper terminal. We'll review and reach out within 24 hours.</p>
      <p style="color:#8a9199; font-size:12px; margin-top:24px;">Wallet on file: <code style="color:#e7ecef;">${escapeHtml(lead.wallet.slice(0, 8))}…${escapeHtml(lead.wallet.slice(-4))}</code></p>
      <p style="color:#ffb547; font-size:12px; border-top:1px solid #1f2630; padding-top:14px; margin-top:24px;">
        <strong>RISK NOTICE:</strong> Sniping newly launched tokens is highly speculative. Most tokens lose all value.
        Past performance is not predictive. You are responsible for your own funds.
      </p>
    </div>
  </div>
</body></html>`;

  try {
    const { error } = await resend.emails.send({
      from: `ARIA Terminal <${CONFIG.FROM_EMAIL}>`,
      to: [lead.email],
      subject: "ARIA Terminal — request received",
      html,
    });
    if (error) {
      logger.warn({ err: error }, "user confirmation failed (non-fatal)");
      return false;
    }
    return true;
  } catch (err) {
    logger.warn({ err }, "user confirmation threw (non-fatal)");
    return false;
  }
}
