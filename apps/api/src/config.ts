import 'dotenv/config';
import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(8000),
  API_HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  TOTP_ISSUER: z.string().default('GestionPatrimonial'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
});

const parsed = configSchema.safeParse(process.env);
if (!parsed.success) {
  // biome-ignore lint/suspicious/noConsoleLog: bootstrap-time error reporting before logger exists
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
