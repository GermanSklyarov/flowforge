export type AppConfig = {
  nodeEnv: string;
  host: string;
  port: number;
};

export function getConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    nodeEnv: env.NODE_ENV ?? 'development',
    host: env.API_HOST ?? '0.0.0.0',
    port: Number.parseInt(env.API_PORT ?? '4000', 10)
  };
}

