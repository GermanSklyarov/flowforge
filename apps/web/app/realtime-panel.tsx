'use client';

import { useEffect, useMemo, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

type WorkflowNodeView = {
  id: string;
  title: string;
};

type ExecutionEvent =
  | {
      type: 'execution.started' | 'execution.succeeded' | 'execution.failed';
      executionId: string;
      workflowId: string;
      timestamp: string;
      error?: string;
    }
  | {
      type: 'node.started' | 'node.succeeded' | 'node.failed';
      executionId: string;
      workflowId: string;
      nodeId: string;
      nodeType: string;
      timestamp: string;
      error?: string;
    }
  | {
      type: 'node.output.delta';
      executionId: string;
      workflowId: string;
      nodeId: string;
      nodeType: string;
      timestamp: string;
      text: string;
    };

type NodeStatus = 'idle' | 'running' | 'succeeded' | 'failed';

type RealtimePanelProps = {
  nodes: readonly WorkflowNodeView[];
};

const socketUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export function RealtimePanel({ nodes }: RealtimePanelProps) {
  const [executionId, setExecutionId] = useState('');
  const [events, setEvents] = useState<ExecutionEvent[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (executionId.trim().length === 0) {
      return;
    }

    const socket: Socket = io(`${socketUrl}/executions`, {
      transports: ['websocket']
    });
    const targetExecutionId = executionId.trim();

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('execution.subscribe', {
        executionId: targetExecutionId
      });
    });
    socket.on('disconnect', () => {
      setConnected(false);
    });
    socket.on('execution.event', (event: ExecutionEvent) => {
      setEvents((current) => [event, ...current].slice(0, 12));
    });

    return () => {
      socket.emit('execution.unsubscribe', {
        executionId: targetExecutionId
      });
      socket.disconnect();
      setConnected(false);
    };
  }, [executionId]);

  const nodeStatuses = useMemo(() => resolveNodeStatuses(nodes, events), [events, nodes]);
  const partialOutput = useMemo(
    () =>
      events
        .filter((event) => event.type === 'node.output.delta')
        .reverse()
        .map((event) => event.text)
        .join(''),
    [events]
  );

  return (
    <section>
      <div className="section-heading">
        <h2>Realtime</h2>
        <span className={connected ? 'socket-state connected' : 'socket-state'} />
      </div>

      <input
        aria-label="Execution ID"
        className="execution-input"
        onChange={(event) => {
          setEvents([]);
          setExecutionId(event.target.value);
        }}
        placeholder="Execution ID"
        value={executionId}
      />

      <div className="node-status-list">
        {nodes.map((node) => (
          <div className="node-status-row" key={node.id}>
            <span className={`node-status-dot ${nodeStatuses[node.id] ?? 'idle'}`} />
            <span>{node.title}</span>
          </div>
        ))}
      </div>

      <div className="partial-output">
        <span>LLM</span>
        <p>{partialOutput || '...'}</p>
      </div>

      <ol className="events realtime-events">
        {events.map((event) => (
          <li key={`${event.timestamp}-${event.type}-${event.executionId}`}>
            <span />
            {formatEvent(event)}
          </li>
        ))}
      </ol>
    </section>
  );
}

function resolveNodeStatuses(
  nodes: readonly WorkflowNodeView[],
  events: ExecutionEvent[]
): Record<string, NodeStatus> {
  const statuses = Object.fromEntries(nodes.map((node) => [node.id, 'idle'])) as Record<
    string,
    NodeStatus
  >;

  for (const event of events.toReversed()) {
    if (!('nodeId' in event)) {
      continue;
    }

    if (event.type === 'node.started') {
      statuses[event.nodeId] = 'running';
    }

    if (event.type === 'node.succeeded') {
      statuses[event.nodeId] = 'succeeded';
    }

    if (event.type === 'node.failed') {
      statuses[event.nodeId] = 'failed';
    }
  }

  return statuses;
}

function formatEvent(event: ExecutionEvent): string {
  if (event.type === 'node.output.delta') {
    return `${event.nodeId}: ${event.text}`;
  }

  if ('nodeId' in event) {
    return `${event.nodeId}: ${event.type.replace('node.', '')}`;
  }

  return event.type.replace('execution.', 'execution ');
}
