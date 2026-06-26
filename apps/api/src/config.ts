export type AppConfig = {
  nodeEnv: string;
  host: string;
  port: number;
  databaseUrl?: string;
};

export function getConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const config: AppConfig = {
    nodeEnv: env.NODE_ENV ?? 'development',
    host: env.API_HOST ?? '0.0.0.0',
    port: Number.parseInt(env.API_PORT ?? '4000', 10)
  };

  if (env.DATABASE_URL) {
    config.databaseUrl = env.DATABASE_URL;
  }

  return config;
}
