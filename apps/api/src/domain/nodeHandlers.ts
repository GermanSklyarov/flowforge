import { randomUUID } from 'node:crypto';
import {
  createDefaultAgentRegistry,
  runAgent,
  type AgentRegistry
} from './agentRegistry';
import { LocalLlmProvider, type LlmProvider } from './llmProvider';
import { callTool, defaultToolRegistry, type ToolRegistry } from './toolRegistry';
import type { WorkflowNode } from './workflowValidation';

export type NodeHandlerContext = {
  executionInput: Record<string, unknown>;
  inboundOutputs: Record<string, Record<string, unknown>>;
  node: WorkflowNode;
};

export type NodeHandlerResult = {
  output: Record<string, unknown>;
  selectedOutputPort?: string;
};

export type NodeHandler = (context: NodeHandlerContext) => Promise<NodeHandlerResult>;

export type NodeHandlerRegistry = Record<string, NodeHandler>;

export type NodeHandlerDependencies = {
  agentRegistry: AgentRegistry;
  llmProvider: LlmProvider;
  toolRegistry: ToolRegistry;
};

const defaultNodeHandlerDependencies: NodeHandlerDependencies = {
  agentRegistry: createDefaultAgentRegistry(),
  llmProvider: new LocalLlmProvider(),
  toolRegistry: defaultToolRegistry
};

export function createDefaultNodeHandlers(
  overrides: Partial<NodeHandlerDependencies> = {}
): NodeHandlerRegistry {
  const dependencies: NodeHandlerDependencies = {
    ...defaultNodeHandlerDependencies,
    ...overrides
  };

  return {
    'trigger.webhook': async ({ executionInput }) => {
      return {
        output: {
          payload: executionInput
        }
      };
    },

    'source.email': async ({ executionInput }) => {
      return {
        output: {
          message: executionInput.message ?? executionInput.body ?? executionInput
        }
      };
    },

    'transform.extractText': async ({ executionInput, inboundOutputs }) => {
      const text = firstString([
        ...Object.values(inboundOutputs).flatMap((output) => [
          output.text,
          output.message,
          output.payload
        ]),
        executionInput.text,
        executionInput.message,
        executionInput.body
      ]);

      return {
        output: {
          text: text ?? JSON.stringify(executionInput)
        }
      };
    },

    'ai.llm': async ({ inboundOutputs, node }) => {
      const llmInput = resolveLlmInput(inboundOutputs, node);
      const result = await dependencies.llmProvider.generateText({
        instruction: llmInput.instruction,
        inputText: llmInput.sourceText,
        model: llmInput.model
      });

      return {
        output: {
          response: result.text,
          model: result.model,
          provider: result.provider,
          usage: result.usage
        }
      };
    },

    'ai.llm.stream': async ({ inboundOutputs, node }) => {
      const llmInput = resolveLlmInput(inboundOutputs, node);
      const chunks: string[] = [];
      let metadata: { model: string; provider: string; usage: Record<string, unknown> } | null = null;

      for await (const event of dependencies.llmProvider.streamText({
        instruction: llmInput.instruction,
        inputText: llmInput.sourceText,
        model: llmInput.model
      })) {
        if (event.type === 'delta') {
          chunks.push(event.text);
        }

        if (event.type === 'completed') {
          metadata = {
            model: event.model,
            provider: event.provider,
            usage: event.usage
          };
        }
      }

      return {
        output: {
          response: chunks.join(''),
          chunks,
          streamed: true,
          model: metadata?.model ?? llmInput.model,
          provider: metadata?.provider ?? 'unknown',
          usage: metadata?.usage ?? {
            inputTokens: 0,
            outputTokens: 0
          }
        }
      };
    },

    'ai.toolCall': async ({ inboundOutputs, node }) => {
      const toolCall = resolveToolCallInput(inboundOutputs, node);
      const result = await callTool(dependencies.toolRegistry, toolCall);

      return {
        output: {
          toolCall: {
            name: result.name,
            arguments: toolCall.arguments
          },
          result: result.result
        }
      };
    },

    'ai.agent': async ({ inboundOutputs, node }) => {
      const agentInput = resolveAgentInput(inboundOutputs, node);
      const result = await runAgent({
        agentRegistry: dependencies.agentRegistry,
        llmProvider: dependencies.llmProvider,
        toolRegistry: dependencies.toolRegistry,
        run: agentInput
      });

      return {
        output: {
          agent: result.name,
          result: result.output
        }
      };
    },

    'logic.decision': async ({ inboundOutputs, node }) => {
      const configuredRoute = node.config?.route;
      const selectedOutputPort =
        configuredRoute === 'false' || configuredRoute === false ? 'false' : 'true';

      return {
        selectedOutputPort,
        output: {
          selectedOutputPort,
          input: inboundOutputs
        }
      };
    },

    'task.create': async ({ inboundOutputs, node }) => {
      const title = firstString([
        node.config?.title,
        ...Object.values(inboundOutputs).flatMap((output) => [
          output.title,
          output.response,
          output.text
        ])
      ]);

      return {
        output: {
          task: {
            id: `task_${randomUUID()}`,
            title: title ?? 'Untitled task',
            status: 'created'
          }
        }
      };
    },

    'notification.telegram': async ({ inboundOutputs, node }) => {
      const message = firstString([
        node.config?.message,
        ...Object.values(inboundOutputs).flatMap((output) => [
          output.message,
          output.response,
          output.text
        ])
      ]);

      return {
        output: {
          result: {
            delivered: true,
            message: message ?? 'Notification sent.'
          }
        }
      };
    }
  };
}

export const defaultNodeHandlers: NodeHandlerRegistry = createDefaultNodeHandlers();

function resolveLlmInput(
  inboundOutputs: Record<string, Record<string, unknown>>,
  node: WorkflowNode
): { instruction: string; model: string | null; sourceText: string | null } {
  return {
    instruction: typeof node.config?.prompt === 'string' ? node.config.prompt : 'Summarize',
    model: typeof node.config?.model === 'string' ? node.config.model : null,
    sourceText: firstString(
      Object.values(inboundOutputs).flatMap((output) => [output.text, output.prompt, output.message])
    )
  };
}

function resolveToolCallInput(
  inboundOutputs: Record<string, Record<string, unknown>>,
  node: WorkflowNode
): { name: string; arguments: Record<string, unknown> } {
  const name = firstString([
    node.config?.toolName,
    ...Object.values(inboundOutputs).map((output) => output.toolName)
  ]);

  if (!name) {
    throw new Error(`Node "${node.id}" requires config.toolName.`);
  }

  const configuredArguments = isRecord(node.config?.arguments) ? node.config.arguments : {};
  const inboundArguments = Object.values(inboundOutputs).find((output) => isRecord(output.arguments))
    ?.arguments;

  return {
    name,
    arguments: {
      ...(isRecord(inboundArguments) ? inboundArguments : {}),
      ...configuredArguments
    }
  };
}

function resolveAgentInput(
  inboundOutputs: Record<string, Record<string, unknown>>,
  node: WorkflowNode
): { name: string; task: string; context: Record<string, unknown> } {
  const name = firstString([
    node.config?.agentName,
    ...Object.values(inboundOutputs).map((output) => output.agentName)
  ]);

  if (!name) {
    throw new Error(`Node "${node.id}" requires config.agentName.`);
  }

  const task = firstString([
    node.config?.task,
    ...Object.values(inboundOutputs).flatMap((output) => [output.task, output.text, output.response])
  ]);

  if (!task) {
    throw new Error(`Node "${node.id}" requires a task input.`);
  }

  return {
    name,
    task,
    context: {
      inboundOutputs
    }
  };
}

function firstString(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
