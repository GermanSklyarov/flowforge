import type { WorkflowNode } from './workflowValidation';

export type NodeExecutionPolicy = {
  maxAttempts: number;
  retryDelayMs: number;
  timeoutMs: number;
};

export const defaultNodeExecutionPolicy: NodeExecutionPolicy = {
  maxAttempts: 1,
  retryDelayMs: 0,
  timeoutMs: 30_000
};

export function resolveNodeExecutionPolicy(node: WorkflowNode): NodeExecutionPolicy {
  const retry = isRecord(node.config?.retry) ? node.config.retry : {};

  return {
    maxAttempts: readPositiveInteger(retry.maxAttempts, defaultNodeExecutionPolicy.maxAttempts),
    retryDelayMs: readNonNegativeInteger(retry.delayMs, defaultNodeExecutionPolicy.retryDelayMs),
    timeoutMs: readPositiveInteger(node.config?.timeoutMs, defaultNodeExecutionPolicy.timeoutMs)
  };
}

function readPositiveInteger(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback;
}

function readNonNegativeInteger(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
