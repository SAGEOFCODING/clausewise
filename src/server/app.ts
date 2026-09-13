import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ZodError } from "zod";
import { documentsRouter } from "./routes/documents";
import { AppError } from "./errors";

export function createApp() {
  const app = express();
  app.use(cors({ origin: true }));
  app.use(express.json({ limit: "80kb" }));

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      name: "ClauseWise API",
      disclaimer: "This tool provides legal information and document assistance, not professional legal advice."
    });
  });

  app.use("/api/documents", documentsRouter);

  if (process.env.NODE_ENV === "production") {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    app.use(express.static(path.resolve(__dirname, "../client")));
    app.get("*", (_req, res) => res.sendFile(path.resolve(__dirname, "../client/index.html")));
  }

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof AppError) {
      return res.status(error.status).json({ error: { message: error.message, code: error.code } });
    }
    if (error instanceof ZodError) {
      return res.status(400).json({ error: { message: "The request was not valid.", code: "VALIDATION_ERROR", details: error.flatten() } });
    }
    if (error && typeof error === "object" && "code" in error && error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: { message: "The document is too large for this demo.", code: "FILE_TOO_LARGE" } });
    }
    if (error && typeof error === "object" && "type" in error && error.type === "entity.parse.failed") {
      return res.status(400).json({ error: { message: "The request body was not valid JSON.", code: "BAD_JSON" } });
    }
    console.error("Unexpected API error", error);
    return res.status(500).json({ error: { message: "Something went wrong while processing the request.", code: "INTERNAL_ERROR" } });
  });

  return app;
}
