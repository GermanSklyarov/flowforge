import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { LlmProvider } from '../src/domain/llmProvider';
import { createDefaultNodeHandlers } from '../src/domain/nodeHandlers';

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
      }
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
});
