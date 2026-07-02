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
});
