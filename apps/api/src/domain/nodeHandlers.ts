import { randomUUID } from 'node:crypto';
import { LocalLlmProvider, type LlmProvider } from './llmProvider';
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
  llmProvider: LlmProvider;
};

const defaultNodeHandlerDependencies: NodeHandlerDependencies = {
  llmProvider: new LocalLlmProvider()
};

export function createDefaultNodeHandlers(
  dependencies: NodeHandlerDependencies = defaultNodeHandlerDependencies
): NodeHandlerRegistry {
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

function firstString(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }

  return null;
}
