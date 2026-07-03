import type { CSSProperties } from 'react';
import { RealtimePanel } from './realtime-panel';

const workflowNodes = [
  { id: 'email', kind: 'Webhook', title: 'Email received', className: 'trigger', x: 2, y: 2 },
  { id: 'extract', kind: 'Transform', title: 'Extract text', className: 'transform', x: 2, y: 9 },
  { id: 'llm', kind: 'AI', title: 'Summarize with GPT', className: 'ai', x: 9, y: 9 },
  { id: 'decision', kind: 'Decision', title: 'Needs action?', className: 'logic', x: 16, y: 9 },
  { id: 'task', kind: 'Task', title: 'Create task', className: 'task', x: 16, y: 16 },
  { id: 'telegram', kind: 'Notify', title: 'Telegram', className: 'notify', x: 23, y: 16 }
] as const;

const navItems = ['Workflows', 'Executions', 'Tasks', 'Documents', 'Agents', 'Integrations'];

export default function HomePage() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">F</span>
          <div>
            <strong>FlowForge</strong>
            <span>Workflow studio</span>
          </div>
        </div>

        <nav className="nav" aria-label="Primary navigation">
          {navItems.map((item) => (
            <a className={item === 'Workflows' ? 'active' : undefined} href="#" key={item}>
              {item}
            </a>
          ))}
        </nav>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <h1>Email summary workflow</h1>
            <p>Receive an email, summarize it with an LLM, create a task, and notify Telegram.</p>
          </div>
          <div className="actions">
            <button className="secondary" type="button">
              Validate
            </button>
            <button type="button">Run draft</button>
          </div>
        </header>

        <section className="content-grid">
          <div className="canvas" aria-label="Workflow canvas">
            {workflowNodes.map((node) => (
              <div
                className={`node ${node.className}`}
                key={node.title}
                style={{ '--x': node.x, '--y': node.y } as CSSProperties}
              >
                <span>{node.kind}</span>
                <strong>{node.title}</strong>
              </div>
            ))}
            <div className="connector c1" />
            <div className="connector c2" />
            <div className="connector c3" />
            <div className="connector c4" />
            <div className="connector c5" />
          </div>

          <aside className="inspector">
            <section>
              <h2>Selected node</h2>
              <dl>
                <div>
                  <dt>Type</dt>
                  <dd>ai.llm</dd>
                </div>
                <div>
                  <dt>Model</dt>
                  <dd>Configurable provider</dd>
                </div>
                <div>
                  <dt>Output</dt>
                  <dd>Structured summary</dd>
                </div>
              </dl>
            </section>

            <RealtimePanel nodes={workflowNodes} />
          </aside>
        </section>
      </main>
    </div>
  );
}
