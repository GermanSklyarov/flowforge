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
- [x] Add retry and timeout policy per node.

## Phase 4: AI

- [x] Add LLM provider abstraction.
- [x] Add external LLM provider implementation.
- [x] Add streaming LLM node.
- [x] Add tool-calling node contract.
- [x] Add agent definitions.

## Phase 5: Realtime

- [x] Add WebSocket gateway.
- [x] Stream execution events to the editor.
- [x] Show live node status and LLM partial output.

## Phase 6: RAG and MCP

- [ ] Add document upload pipeline.
- [ ] Add chunking and embeddings.
- [ ] Add vector search.
- [ ] Expose FlowForge tools through MCP.
