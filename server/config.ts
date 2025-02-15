import 'dotenv/config';

if (!process.env.OPENAI_API_KEY) {
  throw new Error(
    "OPENAI_API_KEY must be set in environment variables.",
  );
}

export const config = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
  },
} as const; 