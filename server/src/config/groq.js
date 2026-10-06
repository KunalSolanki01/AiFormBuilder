import Groq from 'groq-sdk';
import { env } from './env.js';

// Groq is only ever called from the server. The key must never reach the browser.
export const groq = new Groq({
  apiKey: env.GROQ_API_KEY,
  timeout: 45_000,
  maxRetries: 1,
});

export const GROQ_MODEL = env.GROQ_MODEL;
