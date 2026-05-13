import { CONFIG } from "./config.js";
import { logger } from "./logger.js";
import { bot } from "./bot.js";
import { startServer } from "./server.js";

async function main(): Promise<void> {
  logger.info(
    { node: process.version, publicUrl: CONFIG.PUBLIC_URL },
    "ARIA Telegram Terminal starting",
  );

  // Boot HTTP server first — Telegram Mini App must be reachable before bot serves links
  startServer();

  // Start Telegram bot via long polling. For high-traffic, switch to webhooks later.
  bot.start({
    onStart: (info) => {
      logger.info({ username: info.username, id: info.id }, "telegram bot online");
      logger.info(`👉 Tell users to message: https://t.me/${info.username}`);
    },
  }).catch((err) => {
    logger.fatal({ err }, "bot crashed");
    process.exit(1);
  });

  // Graceful shutdown
  const shutdown = async (sig: string) => {
    logger.info({ sig }, "shutting down");
    await bot.stop();
    process.exit(0);
  };
  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.fatal({ err }, "fatal startup error");
  process.exit(1);
});
