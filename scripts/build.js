import { execSync } from "node:child_process";
import fs from "node:fs";

console.log("Running TypeScript typecheck...");
execSync("tsc -b", { stdio: "inherit" });

console.log("Building client bundle with Vite...");
execSync("vite build", { stdio: "inherit" });

console.log("Bundling serverless functions with esbuild...");
execSync(
  "npx esbuild src/server/serverless.ts --bundle --platform=node --target=node20 --format=esm --packages=external --outfile=api/index.js",
  { stdio: "inherit" }
);

fs.copyFileSync("api/index.js", "api/[...all].js");
console.log("Build completed successfully!");
