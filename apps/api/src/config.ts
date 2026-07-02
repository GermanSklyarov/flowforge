import 'dotenv/config';

export type AppConfig = {
  nodeEnv: string;
  host: string;
  port: number;
  databaseUrl?: string;
  redisUrl: string;
  openaiApiKey?: string;
  openaiBaseUrl: string;
  openaiModel: string;
};

export function getConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const config: AppConfig = {
    nodeEnv: env.NODE_ENV ?? 'development',
    host: env.API_HOST ?? '0.0.0.0',
    port: Number.parseInt(env.API_PORT ?? '4000', 10),
    redisUrl: env.REDIS_URL ?? 'redis://localhost:6379',
    openaiBaseUrl: env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
    openaiModel: env.OPENAI_MODEL ?? 'gpt-4.1-mini'
  };

  if (env.DATABASE_URL) {
    config.databaseUrl = env.DATABASE_URL;
  }

  if (env.OPENAI_API_KEY) {
    config.openaiApiKey = env.OPENAI_API_KEY;
  }

  return config;
}
