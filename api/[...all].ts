import type { IncomingMessage, ServerResponse } from "node:http";
import { createApp } from "../src/server/app";

export const config = {
  api: {
    bodyParser: false,
  },
  maxDuration: 60,
};

const app = createApp();

export default function handler(req: IncomingMessage & { url?: string }, res: ServerResponse) {
  try {
    const currentUrl = req.url || "";
    if (currentUrl === "/api" || currentUrl === "/" || !currentUrl.startsWith("/api/")) {
      const orig = (req.headers["x-vercel-original-url"] || req.headers["x-matched-path"]) as string | undefined;
      if (orig && orig.startsWith("/api") && orig !== "/api") {
        req.url = orig;
      }
    }

    return app(req, res);
  } catch (err: any) {
    console.error("Vercel Function Error:", err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({
      error: {
        message: err?.message || "Serverless Function Error",
        stack: err?.stack,
      },
    }));
  }
}

