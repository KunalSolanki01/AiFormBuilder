import { z } from 'zod';

const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';

// Placeholders let the test suite import the app without real credentials.
// Services that touch Supabase/Groq are mocked in tests.
const testDefaults = isTest
  ? {
      SUPABASE_URL: 'http://localhost:54321',
      SUPABASE_ANON_KEY: 'test-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
      GROQ_API_KEY: 'test-groq-key',
      GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com',
    }
  : {};

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  SUPABASE_URL: z.url({ error: 'SUPABASE_URL must be a valid URL' }),
  SUPABASE_ANON_KEY: z.string().min(1, { error: 'SUPABASE_ANON_KEY is required' }),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, { error: 'SUPABASE_SERVICE_ROLE_KEY is required' }),
  GROQ_API_KEY: z.string().min(1, { error: 'GROQ_API_KEY is required' }),
  GROQ_MODEL: z.string().min(1).default('openai/gpt-oss-120b'),
  // Public OAuth client id (not a secret). Enables "verify email with Google" on forms.
  GOOGLE_CLIENT_ID: z.string().trim().optional().transform((v) => v || undefined),
  // Number of reverse proxies in front of the API (Render/Railway = 1).
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),
});

const parsed = envSchema.safeParse({ ...testDefaults, ...process.env, ...(isTest ? { NODE_ENV: 'test' } : {}) });

if (!parsed.success) {
  const problems = parsed.error.issues.map((i) => `  • ${i.path.join('.')}: ${i.message}`).join('\n');
  console.error(`\n❌ Invalid server environment configuration:\n${problems}\n\nCopy .env.example to server/.env and fill it in.\n`);
  process.exit(1);
}

export const env = Object.freeze({
  ...parsed.data,
  CLIENT_ORIGINS: parsed.data.CLIENT_URL.split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean),
  isProduction: parsed.data.NODE_ENV === 'production',
  isTest: parsed.data.NODE_ENV === 'test',
});
