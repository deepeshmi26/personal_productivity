import app from "./app";
import { runQuestionGenerator } from "./jobs/responseProcessingWorker";
import { logger } from "./lib/logger";

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

app.listen(port, "0.0.0.0", (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});


void runQuestionGenerator().catch((err) => {
  logger.error({ err }, "Question worker: initial batch failed");
});

setInterval(() => {
  void runQuestionGenerator().catch((err) => {
    logger.error({ err }, "Question worker: batch failed");
  });
}, 5000);
