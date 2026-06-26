import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
  UnprocessableEntityException
} from '@nestjs/common';
import {
  type WorkflowRecord,
  type WorkflowRepository
} from '../domain/workflowRepository';
import { validateWorkflow, type WorkflowDefinition } from '../domain/workflowValidation';
import { WORKFLOW_REPOSITORY } from '../persistence/tokens';

@Controller('workflows')
export class WorkflowsController {
  constructor(
    @Inject(WORKFLOW_REPOSITORY)
    private readonly workflowRepository: WorkflowRepository
  ) {}

  @Get()
  async list(): Promise<Record<string, unknown>> {
    const workflows = await this.workflowRepository.list();
    return {
      workflows: workflows.map(toWorkflowResponse)
    };
  }

  @Post()
  async create(@Body() body: unknown): Promise<Record<string, unknown>> {
    const workflow = parseWorkflow(body);
    const record = await this.workflowRepository.create({ definition: workflow });

    return {
      workflow: toWorkflowResponse(record)
    };
  }

  @Post('validate')
  validate(@Body() body: unknown): Record<string, unknown> {
    const validation = validateWorkflow(body);
    return validation;
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<Record<string, unknown>> {
    const record = await this.workflowRepository.findById(id);

    if (!record) {
      throw new NotFoundException('Workflow not found.');
    }

    return {
      workflow: toWorkflowResponse(record)
    };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: unknown): Promise<Record<string, unknown>> {
    const workflow = parseWorkflow(body);
    const record = await this.workflowRepository.update(id, { definition: workflow });

    if (!record) {
      throw new NotFoundException('Workflow not found.');
    }

    return {
      workflow: toWorkflowResponse(record)
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async delete(@Param('id') id: string): Promise<Record<string, unknown>> {
    const deleted = await this.workflowRepository.delete(id);

    if (!deleted) {
      throw new NotFoundException('Workflow not found.');
    }

    return { deleted: true };
  }
}

function parseWorkflow(body: unknown): WorkflowDefinition {
  const validation = validateWorkflow(body);

  if (!validation.valid) {
    throw new UnprocessableEntityException(validation);
  }

  return body as WorkflowDefinition;
}

function toWorkflowResponse(record: WorkflowRecord): Record<string, unknown> {
  return {
    id: record.id,
    name: record.name,
    status: record.status,
    version: record.version,
    definition: record.definition,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}
