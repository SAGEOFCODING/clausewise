import type { IncomingMessage, ServerResponse } from "node:http";

export const config = {
  api: {
    bodyParser: false,
  },
  maxDuration: 60,
};

let cachedApp: any = null;

export default async function handler(req: IncomingMessage & { url?: string }, res: ServerResponse) {
  try {
    const rawPath = (req.headers["x-matched-path"] || req.headers["x-vercel-original-url"] || req.url) as string;
    if (typeof rawPath === "string" && rawPath.startsWith("/api")) {
      req.url = rawPath;
    }
    if (!cachedApp) {
      const { createApp } = await import("../src/server/app");
      cachedApp = createApp();
    }
    return cachedApp(req, res);
  } catch (err: any) {
    console.error("Vercel Function Error:", err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({
      error: {
        message: err?.message || "Serverless Function Error",
        stack: err?.stack
      }
    }));
  }
}
