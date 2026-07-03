import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ExecutionEvent } from '../src/domain/executionEvents';
import { InMemoryExecutionEventBus } from '../src/domain/executionEvents';
import { ExecutionsGateway } from '../src/realtime/executions.gateway';

describe('ExecutionsGateway', () => {
  it('subscribes clients to execution rooms and forwards events', () => {
    const eventBus = new InMemoryExecutionEventBus();
    const emitted: Array<{ event: string; payload: unknown; room: string }> = [];
    const gateway = new ExecutionsGateway(eventBus);
    const client = {
      join(room: string) {
        emitted.push({ event: 'join', payload: null, room });
      },
      leave() {
        return;
      },
      emit() {
        return;
      }
    };

    gateway.server = {
      to(room: string) {
        return {
          emit(event: string, payload: unknown) {
            emitted.push({ event, payload, room });
          }
        };
      }
    } as never;
    gateway.afterInit();

    assert.deepEqual(
      gateway.subscribeToExecution(client as never, { executionId: 'exec_1' }),
      {
        ok: true,
        executionId: 'exec_1'
      }
    );

    const event: ExecutionEvent = {
      type: 'execution.started',
      executionId: 'exec_1',
      workflowId: 'workflow_1',
      timestamp: '2026-07-03T00:00:00.000Z'
    };
    eventBus.publish(event);

    assert.deepEqual(emitted, [
      {
        event: 'join',
        payload: null,
        room: 'execution:exec_1'
      },
      {
        event: 'execution.event',
        payload: event,
        room: 'execution:exec_1'
      }
    ]);

    gateway.onModuleDestroy();
  });
});
