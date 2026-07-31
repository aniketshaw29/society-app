import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  PORT: z
    .string()
    .default('3000')
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0, {
      message: 'PORT must be a positive integer',
    }),

  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  SUPABASE_URL: z
    .string()
    .url({ message: 'SUPABASE_URL must be a valid URL' }),

  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, { message: 'SUPABASE_SERVICE_ROLE_KEY is required' }),

  FIREBASE_PROJECT_ID: z
    .string()
    .min(1, { message: 'FIREBASE_PROJECT_ID is required' }),

  FIREBASE_CLIENT_EMAIL: z
    .string()
    .email({ message: 'FIREBASE_CLIENT_EMAIL must be a valid email' }),

  FIREBASE_PRIVATE_KEY: z
    .string()
    .min(1, { message: 'FIREBASE_PRIVATE_KEY is required' })
    .transform((val) => val.replace(/\\n/g, '\n')), // Handle escaped newlines

  FRONTEND_URL: z
    .string()
    .url({ message: 'FRONTEND_URL must be a valid URL' }),

  API_SECRET_KEY: z
    .string()
    .min(32, { message: 'API_SECRET_KEY must be at least 32 characters' }),
});

export type Config = z.infer<typeof envSchema>;

let _config: Config | null = null;

export function validateEnv(): Config {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
      .join('\n');

    throw new Error(
      `Environment validation failed. Missing or invalid variables:\n${errors}\n\nSee .env.example for required variables.`
    );
  }

  _config = result.data;
  return _config;
}

export function getConfig(): Config {
  if (!_config) {
    return validateEnv();
  }
  return _config;
}

// Export for convenience — only safe to use after validateEnv() has been called
export const config = new Proxy({} as Config, {
  get(_target, prop: string) {
    const cfg = getConfig();
    return cfg[prop as keyof Config];
  },
});
