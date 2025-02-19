import 'dotenv/config';

const requiredEnvVars = [
  'DATABASE_URL',
  'OPENAI_API_KEY',
  'SESSION_SECRET'
] as const;

// Validate all required environment variables are present
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingEnvVars.join(', ')}`
  );
}

// Optional environment variables with defaults
const PORT = parseInt(process.env.PORT || '3000', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';

// Validate database URL format
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

try {
  const dbUrl = new URL(process.env.DATABASE_URL);
  if (!dbUrl.host || !dbUrl.pathname) {
    throw new Error('Invalid DATABASE_URL format');
  }
} catch (error) {
  throw new Error('Invalid DATABASE_URL format: ' + (error instanceof Error ? error.message : 'unknown error'));
}

export const config = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  server: {
    port: PORT,
    nodeEnv: NODE_ENV,
    isProduction: NODE_ENV === 'production',
  },
  session: {
    secret: process.env.SESSION_SECRET,
  }
} as const;

// Type guard to ensure all config values are present
Object.entries(config).forEach(([category, values]) => {
  Object.entries(values).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      throw new Error(`Configuration error: ${category}.${key} is not defined`);
    }
  });
}); 