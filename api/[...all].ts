import { createApp } from "../src/server/app";

const app = createApp();

export const config = {
  api: {
    bodyParser: false,
  },
  maxDuration: 60,
};

export default function handler(req: any, res: any) {
  // Preserve original request URL if rewritten by Vercel edge
  const rawPath = req.headers["x-matched-path"] || req.headers["x-vercel-original-url"];
  if (typeof rawPath === "string" && rawPath.startsWith("/api") && req.url !== rawPath) {
    req.url = rawPath;
  }
  return app(req, res);
}
