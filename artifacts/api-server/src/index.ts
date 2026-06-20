import app from "./app";
import { logger } from "./lib/logger";
import { startScheduler } from "./lib/scheduler";
import { startAnalyticsScheduler } from "./lib/analytics-scheduler";
import { startEmailNudgeScheduler } from "./lib/email-nudges";
import { startCommentCollector } from "./lib/comment-collector";
import { aiCapabilities } from "./lib/ai-providers";

// Local laptops sleep, change networks, and drop WiFi. When that happens the
// idle pg pool connection to Neon emits an 'error' from its idleListener with
// no handler attached, which by default would crash the whole process.
// Log and keep running — the next query reconnects automatically.
// In production, an orchestrator (Railway/Render) should restart on hard crash,
// so consider tightening these handlers when deploying.
process.on("uncaughtException", (err) => {
  logger.error({ err }, "uncaughtException — keeping process alive");
});
process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "unhandledRejection — keeping process alive");
});

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  logger.info({ aiCapabilities }, "AI providers configured");
  startScheduler();
  startAnalyticsScheduler();
  startEmailNudgeScheduler();
  startCommentCollector();
});
