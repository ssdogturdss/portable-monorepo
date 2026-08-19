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

// Bind to 0.0.0.0 so the server is reachable inside Docker containers,
// behind reverse proxies, and on VPS servers — not just on localhost.
app.listen(port, "0.0.0.0", (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
