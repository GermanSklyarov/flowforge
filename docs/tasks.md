# Implementation Plan

## Phase 1: Foundation

- [x] Repository structure.
- [x] API health and readiness endpoints.
- [x] Node catalog endpoint.
- [x] Workflow validation endpoint.
- [x] Static editor shell.
- [x] Docker Compose setup.

## Phase 2: Persistence

- [x] Add PostgreSQL connection and migrations.
- [x] Create workflow tables.
- [x] Implement workflow CRUD endpoints.
- [ ] Add integration tests for persistence.

## Phase 3: Execution

- [x] Add Redis and BullMQ.
- [x] Add worker application.
- [x] Implement graph execution state machine.
- [x] Store execution logs and node statuses.
- [x] Add typed node handler registry.
- [x] Add decision node branch routing.
- [ ] Add retry and timeout policy per node.

## Phase 4: AI

- [ ] Add LLM provider abstraction.
- [ ] Add streaming LLM node.
- [ ] Add tool-calling node contract.
- [ ] Add agent definitions.

## Phase 5: Realtime

- [ ] Add WebSocket gateway.
- [ ] Stream execution events to the editor.
- [ ] Show live node status and LLM partial output.

## Phase 6: RAG and MCP

- [ ] Add document upload pipeline.
- [ ] Add chunking and embeddings.
- [ ] Add vector search.
- [ ] Expose FlowForge tools through MCP.
