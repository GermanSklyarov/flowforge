import { Controller, Get } from '@nestjs/common';

const startedAt = new Date();

@Controller()
export class HealthController {
  @Get('health')
  health(): Record<string, unknown> {
    return {
      status: 'ok',
      service: 'flowforge-api',
      uptimeSeconds: Math.floor((Date.now() - startedAt.getTime()) / 1000)
    };
  }

  @Get('ready')
  ready(): Record<string, unknown> {
    return {
      status: 'ready',
      checks: {
        api: 'ok',
        workflows: 'ok'
      }
    };
  }
}

