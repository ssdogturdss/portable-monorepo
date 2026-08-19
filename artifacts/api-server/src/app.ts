import path from "path";
import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { ZodError } from "zod";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// CORS — configurable via CORS_ORIGIN env var.
// In development (no CORS_ORIGIN): allow all origins.
// In production (no CORS_ORIGIN): block all cross-origin requests.
// With CORS_ORIGIN: allow only the listed origins.
const isProduction = process.env["NODE_ENV"] === "production";
const rawCorsOrigin = process.env["CORS_ORIGIN"];
const corsOrigin: string | string[] | boolean = rawCorsOrigin
  ? rawCorsOrigin.split(",").map((o) => o.trim())
  : !isProduction;

app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Global error handler — must be defined after routes
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    res.status(422).json({ error: err.message });
    return;
  }
  logger.error(err);
  res.status(500).json({ error: "Internal server error" });
});

// Serve AI IDE frontend static files when SERVE_FRONTEND=true.
// The Dockerfile places the built frontend at /app/public.
// This catch-all must come after /api routes.
if (process.env["SERVE_FRONTEND"] === "true") {
  const publicDir = path.join(
    // import.meta.dirname is the dist/ directory at runtime
    import.meta.dirname,
    "..",
    "public",
  );
  app.use(express.static(publicDir));
  // SPA fallback — serves index.html for any unmatched GET
  app.use((_req: Request, res: Response) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });
}

export default app;
