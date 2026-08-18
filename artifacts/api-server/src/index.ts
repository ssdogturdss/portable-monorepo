import app from "./app";
import { logger } from "./lib/logger";
import { validateEnv } from "./lib/env";

let port: number;
try {
  ({ port } = validateEnv());
} catch (err) {
  // eslint-disable-next-line no-console
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
