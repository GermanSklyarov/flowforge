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
  type ExecutionRecord,
  type ExecutionRepository,
  type NodeExecutionRecord
} from '../domain/executionRepository';
import {
  type WorkflowRecord,
  type WorkflowRepository
} from '../domain/workflowRepository';
import { validateWorkflow, type WorkflowDefinition } from '../domain/workflowValidation';
import type { ExecutionQueue } from '../queue/executionQueue';
import { EXECUTION_QUEUE, EXECUTION_REPOSITORY, WORKFLOW_REPOSITORY } from '../persistence/tokens';

@Controller('workflows')
export class WorkflowsController {
  constructor(
    @Inject(WORKFLOW_REPOSITORY)
    private readonly workflowRepository: WorkflowRepository,
    @Inject(EXECUTION_REPOSITORY)
    private readonly executionRepository: ExecutionRepository,
    @Inject(EXECUTION_QUEUE)
    private readonly executionQueue: ExecutionQueue
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

  @Get(':id/executions')
  async listExecutions(@Param('id') id: string): Promise<Record<string, unknown>> {
    await this.getWorkflowOrThrow(id);
    const executions = await this.executionRepository.listByWorkflowId(id);

    return {
      executions: executions.map(toExecutionResponse)
    };
  }

  @Get(':id/executions/:executionId')
  async getExecution(
    @Param('id') workflowId: string,
    @Param('executionId') executionId: string
  ): Promise<Record<string, unknown>> {
    await this.getWorkflowOrThrow(workflowId);
    const execution = await this.executionRepository.findById(executionId);

    if (!execution || execution.workflowId !== workflowId) {
      throw new NotFoundException('Execution not found.');
    }

    const nodes = await this.executionRepository.listNodesByExecutionId(executionId);

    return {
      execution: toExecutionResponse(execution),
      nodes: nodes.map(toNodeExecutionResponse)
    };
  }

  @Post(':id/run')
  async run(@Param('id') id: string, @Body() body: unknown): Promise<Record<string, unknown>> {
    const workflow = await this.getWorkflowOrThrow(id);
    const execution = await this.executionRepository.createQueued({
      workflow,
      input: parseExecutionInput(body)
    });

    await this.executionQueue.enqueueWorkflowExecution({
      executionId: execution.id,
      workflowId: workflow.id
    });

    return {
      execution: toExecutionResponse(execution)
    };
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<Record<string, unknown>> {
    const record = await this.getWorkflowOrThrow(id);

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

  async getWorkflowOrThrow(id: string): Promise<WorkflowRecord> {
    const record = await this.workflowRepository.findById(id);

    if (!record) {
      throw new NotFoundException('Workflow not found.');
    }

    return record;
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

function parseExecutionInput(body: unknown): Record<string, unknown> {
  if (body === undefined || body === null) {
    return {};
  }

  if (!isRecord(body)) {
    throw new UnprocessableEntityException({
      valid: false,
      errors: [{ path: '$', message: 'Execution input must be an object.' }]
    });
  }

  if (body.input === undefined) {
    return body;
  }

  if (!isRecord(body.input)) {
    throw new UnprocessableEntityException({
      valid: false,
      errors: [{ path: 'input', message: 'Execution input must be an object.' }]
    });
  }

  return body.input;
}

function toExecutionResponse(record: ExecutionRecord): Record<string, unknown> {
  return {
    id: record.id,
    workflowId: record.workflowId,
    status: record.status,
    input: record.input,
    output: record.output,
    error: record.error,
    queuedAt: record.queuedAt.toISOString(),
    startedAt: record.startedAt?.toISOString() ?? null,
    finishedAt: record.finishedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function toNodeExecutionResponse(record: NodeExecutionRecord): Record<string, unknown> {
  return {
    id: record.id,
    executionId: record.executionId,
    nodeId: record.nodeId,
    nodeType: record.nodeType,
    status: record.status,
    input: record.input,
    output: record.output,
    error: record.error,
    startedAt: record.startedAt?.toISOString() ?? null,
    finishedAt: record.finishedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
