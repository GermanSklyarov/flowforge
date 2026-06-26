# FlowForge

AI Workflow Platform: a visual automation builder that combines workflow orchestration, AI agents, tool calling, RAG, realtime execution logs, and task management.

## First Milestone

This repository starts with a TypeScript product foundation:

- NestJS API service with health, readiness, node catalog, workflow validation, and workflow CRUD endpoints.
- Next.js web app with a visual workflow canvas shell.
- Shared workflow vocabulary documented in code and docs.
- Docker Compose for one-command local startup.

## Run Locally

```bash
npm test
npm run typecheck
npm run db:migrate
npm run dev
```

API:

- `GET http://localhost:4000/health`
- `GET http://localhost:4000/ready`
- `GET http://localhost:4000/catalog/nodes`
- `POST http://localhost:4000/workflows/validate`
- `GET http://localhost:4000/workflows`
- `POST http://localhost:4000/workflows`
- `GET http://localhost:4000/workflows/:id`
- `PUT http://localhost:4000/workflows/:id`
- `DELETE http://localhost:4000/workflows/:id`

Web:

- `http://localhost:5173`

Docker:

```bash
docker compose up --build
```

Requires Node.js 24+.
The local PostgreSQL port is `55432` to avoid collisions with a machine-level Postgres on `5432`.

## Roadmap

1. Project foundation: repository structure, API skeleton, workflow domain model, editor shell, Docker Compose.
2. Persistent workflows: PostgreSQL schema, migrations, workflow CRUD, validation at write time.
3. Execution engine: graph runner, BullMQ queue, worker process, retries, execution history.
4. LLM integration: provider abstraction, streaming responses, prompt templates, tool calling contract.
5. Realtime UX: WebSocket event stream for agent steps, node status, logs, and partial LLM output.
6. Task management: Jira-like projects, tasks, comments, labels, assignments, workflow-created tasks.
7. Integrations: Telegram, webhook triggers, email ingestion, outbound HTTP, credentials vault.
8. RAG: document uploads, chunking, embeddings, vector store, source-grounded Q&A nodes.
9. AI agents: reusable agent definitions, task decomposition, planner/executor loops, guardrails.
10. MCP server: expose FlowForge actions such as `createTask`, `searchUsers`, and `runWorkflow`.
11. Observability and ops: Sentry, structured logs, metrics, tracing, production Docker profile.
