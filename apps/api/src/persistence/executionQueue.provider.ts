import type { Provider } from '@nestjs/common';
import { getConfig } from '../config';
import { BullmqExecutionQueue } from '../queue/bullmqExecutionQueue';
import { EXECUTION_QUEUE } from './tokens';

export const ExecutionQueueProvider: Provider = {
  provide: EXECUTION_QUEUE,
  useFactory: () => {
    const config = getConfig();
    return new BullmqExecutionQueue(config.redisUrl);
  }
};

