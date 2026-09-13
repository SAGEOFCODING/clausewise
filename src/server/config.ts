import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  PORT: z.coerce.number().int().positive().default(4174),
  MAX_UPLOAD_MB: z.coerce.number().int().positive().max(25).default(6)
});

export const config = envSchema.parse(process.env);
export const maxUploadBytes = config.MAX_UPLOAD_MB * 1024 * 1024;
