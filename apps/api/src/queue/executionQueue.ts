export const EXECUTION_QUEUE_NAME = 'workflow-executions';

export type WorkflowExecutionJobData = {
  executionId: string;
  workflowId: string;
};

export type ExecutionQueue = {
  enqueueWorkflowExecution(data: WorkflowExecutionJobData): Promise<void>;
  close(): Promise<void>;
};

