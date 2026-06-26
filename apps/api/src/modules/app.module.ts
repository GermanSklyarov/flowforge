import { Module } from '@nestjs/common';
import { CatalogController } from '../presentation/catalog.controller';
import { HealthController } from '../presentation/health.controller';
import { WorkflowsController } from '../presentation/workflows.controller';
import { WorkflowRepositoryProvider } from '../persistence/workflowRepository.provider';

@Module({
  controllers: [CatalogController, HealthController, WorkflowsController],
  providers: [WorkflowRepositoryProvider]
})
export class AppModule {}

