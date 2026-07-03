import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createDefaultAgentRegistry, runAgent } from '../src/domain/agentRegistry';
import type { LlmProvider } from '../src/domain/llmProvider';
import { defaultToolRegistry } from '../src/domain/toolRegistry';

describe('runAgent', () => {
  it('runs task breakdown agents and parses subtasks from JSON', async () => {
    const llmProvider: LlmProvider = {
      async generateText() {
        return {
          text: JSON.stringify({
            subtasks: [
              {
                title: 'Design workflow',
                description: 'Define nodes and edges.'
              }
            ]
          }),
          model: 'test-model',
          provider: 'test',
          usage: {
            inputTokens: 4,
            outputTokens: 5
          }
        };
      },
      async *streamText() {
        throw new Error('Unexpected streamText call.');
      }
    };

    const result = await runAgent({
      agentRegistry: createDefaultAgentRegistry(),
      llmProvider,
      toolRegistry: defaultToolRegistry,
      run: {
        name: 'taskBreakdown',
        task: 'Build workflow editor',
        context: {}
      }
    });

    assert.equal(result.name, 'taskBreakdown');
    assert.deepEqual(result.output.subtasks, [
      {
        title: 'Design workflow',
        description: 'Define nodes and edges.'
      }
    ]);
    assert.equal(result.output.model, 'test-model');
  });

  it('rejects unknown agents', async () => {
    await assert.rejects(
      runAgent({
        agentRegistry: createDefaultAgentRegistry(),
        llmProvider: createUnexpectedLlmProvider(),
        toolRegistry: defaultToolRegistry,
        run: {
          name: 'missingAgent',
          task: 'Build workflow editor',
          context: {}
        }
      }),
      /not registered/
    );
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
