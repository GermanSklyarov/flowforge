import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AgentRegistry } from '../src/domain/agentRegistry';
import type { LlmProvider } from '../src/domain/llmProvider';
import { createDefaultNodeHandlers } from '../src/domain/nodeHandlers';
import { defaultToolRegistry } from '../src/domain/toolRegistry';

describe('createDefaultNodeHandlers', () => {
  it('executes LLM nodes through the configured provider', async () => {
    const calls: Array<Parameters<LlmProvider['generateText']>[0]> = [];
    const handlers = createDefaultNodeHandlers({
      llmProvider: {
        async generateText(input) {
          calls.push(input);

          return {
            text: 'provider response',
            model: input.model ?? 'test-model',
            provider: 'test',
            usage: {
              inputTokens: 3,
              outputTokens: 4
            }
          };
        },
        async *streamText() {
          throw new Error('Unexpected streamText call.');
        }
      },
      toolRegistry: defaultToolRegistry
    });

    const llmHandler = handlers['ai.llm'];

    assert.ok(llmHandler);

    const result = await llmHandler({
      executionInput: {},
      inboundOutputs: {
        extract: {
          text: 'Quarterly update'
        }
      },
      node: {
        id: 'llm',
        type: 'ai.llm',
        config: {
          prompt: 'Summarize',
          model: 'gpt-test'
        }
      }
    });

    assert.deepEqual(calls, [
      {
        instruction: 'Summarize',
        inputText: 'Quarterly update',
        model: 'gpt-test'
      }
    ]);
    assert.deepEqual(result.output, {
      response: 'provider response',
      model: 'gpt-test',
      provider: 'test',
      usage: {
        inputTokens: 3,
        outputTokens: 4
      }
    });
  });

  it('executes streaming LLM nodes and stores chunks', async () => {
    const handlers = createDefaultNodeHandlers({
      llmProvider: {
        async generateText() {
          throw new Error('Unexpected generateText call.');
        },
        async *streamText() {
          yield {
            type: 'delta',
            text: 'Hello '
          };
          yield {
            type: 'delta',
            text: 'there'
          };
          yield {
            type: 'completed',
            model: 'stream-model',
            provider: 'test',
            usage: {
              inputTokens: 2,
              outputTokens: 3
            }
          };
        }
      }
    });
    const streamHandler = handlers['ai.llm.stream'];

    assert.ok(streamHandler);

    const result = await streamHandler({
      executionInput: {},
      inboundOutputs: {
        extract: {
          text: 'Greeting request'
        }
      },
      node: {
        id: 'stream',
        type: 'ai.llm.stream',
        config: {
          prompt: 'Greet'
        }
      }
    });

    assert.deepEqual(result.output, {
      response: 'Hello there',
      chunks: ['Hello ', 'there'],
      streamed: true,
      model: 'stream-model',
      provider: 'test',
      usage: {
        inputTokens: 2,
        outputTokens: 3
      }
    });
  });

  it('executes registered tools with structured arguments', async () => {
    const calls: Array<Record<string, unknown>> = [];
    const handlers = createDefaultNodeHandlers({
      llmProvider: createUnexpectedLlmProvider(),
      toolRegistry: {
        createTask: {
          name: 'createTask',
          description: 'Creates a task.',
          async execute(arguments_) {
            calls.push(arguments_);

            return {
              task: {
                id: 'task_test',
                title: arguments_.title
              }
            };
          }
        }
      }
    });
    const toolHandler = handlers['ai.toolCall'];

    assert.ok(toolHandler);

    const result = await toolHandler({
      executionInput: {},
      inboundOutputs: {
        llm: {
          arguments: {
            title: 'From inbound',
            description: 'From inbound output'
          }
        }
      },
      node: {
        id: 'tool',
        type: 'ai.toolCall',
        config: {
          toolName: 'createTask',
          arguments: {
            title: 'From config'
          }
        }
      }
    });

    assert.deepEqual(calls, [
      {
        title: 'From config',
        description: 'From inbound output'
      }
    ]);
    assert.deepEqual(result.output, {
      toolCall: {
        name: 'createTask',
        arguments: {
          title: 'From config',
          description: 'From inbound output'
        }
      },
      result: {
        task: {
          id: 'task_test',
          title: 'From config'
        }
      }
    });
  });

  it('rejects tool call nodes without a tool name', async () => {
    const handlers = createDefaultNodeHandlers({
      llmProvider: createUnexpectedLlmProvider(),
      toolRegistry: defaultToolRegistry
    });
    const toolHandler = handlers['ai.toolCall'];

    assert.ok(toolHandler);

    await assert.rejects(
      toolHandler({
        executionInput: {},
        inboundOutputs: {},
        node: {
          id: 'tool',
          type: 'ai.toolCall'
        }
      }),
      /requires config\.toolName/
    );
  });

  it('executes registered agents with task input', async () => {
    const agentRegistry: AgentRegistry = {
      taskBreakdown: {
        name: 'taskBreakdown',
        description: 'Breaks a task into subtasks.',
        async run(context) {
          return {
            task: context.task,
            subtasks: [
              {
                title: 'First subtask',
                description: 'Start here.'
              }
            ]
          };
        }
      }
    };
    const handlers = createDefaultNodeHandlers({
      agentRegistry,
      llmProvider: createUnexpectedLlmProvider(),
      toolRegistry: defaultToolRegistry
    });
    const agentHandler = handlers['ai.agent'];

    assert.ok(agentHandler);

    const result = await agentHandler({
      executionInput: {},
      inboundOutputs: {
        extract: {
          text: 'Build a task board'
        }
      },
      node: {
        id: 'agent',
        type: 'ai.agent',
        config: {
          agentName: 'taskBreakdown'
        }
      }
    });

    assert.deepEqual(result.output, {
      agent: 'taskBreakdown',
      result: {
        task: 'Build a task board',
        subtasks: [
          {
            title: 'First subtask',
            description: 'Start here.'
          }
        ]
      }
    });
  });
});

function createUnexpectedLlmProvider(): LlmProvider {
  return {
    async generateText() {
      throw new Error('Unexpected generateText call.');
    },
    async *streamText() {
      throw new Error('Unexpected streamText call.');
    }
  };
}
