import type { OnModuleDestroy } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { getConfig } from '../config';
import {
  RedisExecutionEventSubscriber,
  type ExecutionEvent,
  type ExecutionEventSubscriber
} from '../domain/executionEvents';

type SubscribeExecutionPayload = {
  executionId?: unknown;
};

@WebSocketGateway({
  cors: {
    origin: true
  },
  namespace: '/executions'
})
export class ExecutionsGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, OnModuleDestroy
{
  @WebSocketServer()
  server!: Server;

  readonly #eventSubscriber: ExecutionEventSubscriber;
  #unsubscribe: (() => void) | null = null;
  #closeSubscriber: (() => Promise<void>) | null = null;

  constructor(eventSubscriber?: ExecutionEventSubscriber) {
    if (eventSubscriber) {
      this.#eventSubscriber = eventSubscriber;
      return;
    }

    const subscriber = new RedisExecutionEventSubscriber(getConfig().redisUrl);
    this.#eventSubscriber = subscriber;
    this.#closeSubscriber = () => subscriber.close();
  }

  afterInit(): void {
    this.#unsubscribe = this.#eventSubscriber.subscribe((event) => {
      this.#publishExecutionEvent(event);
    });
  }

  handleConnection(client: Socket): void {
    client.emit('connected', {
      namespace: '/executions'
    });
  }

  handleDisconnect(): void {
    return;
  }

  onModuleDestroy(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    void this.#closeSubscriber?.();
    this.#closeSubscriber = null;
  }

  @SubscribeMessage('execution.subscribe')
  subscribeToExecution(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SubscribeExecutionPayload
  ): { executionId: string; ok: true } | { error: string; ok: false } {
    if (typeof payload.executionId !== 'string' || payload.executionId.trim().length === 0) {
      return {
        ok: false,
        error: 'executionId is required.'
      };
    }

    const executionId = payload.executionId;
    void client.join(executionRoom(executionId));

    return {
      ok: true,
      executionId
    };
  }

  @SubscribeMessage('execution.unsubscribe')
  unsubscribeFromExecution(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SubscribeExecutionPayload
  ): { executionId: string; ok: true } | { error: string; ok: false } {
    if (typeof payload.executionId !== 'string' || payload.executionId.trim().length === 0) {
      return {
        ok: false,
        error: 'executionId is required.'
      };
    }

    const executionId = payload.executionId;
    void client.leave(executionRoom(executionId));

    return {
      ok: true,
      executionId
    };
  }

  #publishExecutionEvent(event: ExecutionEvent): void {
    this.server.to(executionRoom(event.executionId)).emit('execution.event', event);
  }
}

function executionRoom(executionId: string): string {
  return `execution:${executionId}`;
}
