import { Module } from '@nestjs/common';
import { CatalogController } from '../presentation/catalog.controller';
import { HealthController } from '../presentation/health.controller';
import { WorkflowsController } from '../presentation/workflows.controller';
import { ExecutionQueueProvider } from '../persistence/executionQueue.provider';
import { ExecutionRepositoryProvider } from '../persistence/executionRepository.provider';
import { WorkflowRepositoryProvider } from '../persistence/workflowRepository.provider';

@Module({
  controllers: [CatalogController, HealthController, WorkflowsController],
  providers: [ExecutionQueueProvider, ExecutionRepositoryProvider, WorkflowRepositoryProvider]
})
export class AppModule {}
