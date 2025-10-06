import { Logger, UseFilters } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { Server, Socket } from 'socket.io';

import { ENV, LOGGER_CONTEXT, WEBSOCKET_CORS_ORIGINS, WEBSOCKET_TRANSPORTS } from '@/shared/enums';
import { WsExceptionFilter } from '@/shared/filters';
import { SocketAuthMiddleware } from '@/shared/middlewares';

@WebSocketGateway({
  transports: WEBSOCKET_TRANSPORTS,
  cors: {
    origin: WEBSOCKET_CORS_ORIGINS,
  },
})
@UseFilters(WsExceptionFilter)
export class WebsocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(WebsocketGateway.name);

  private redisPubClient;
  private redisSubClient;

  private socketClients: Set<Socket> = new Set();

  @WebSocketServer() server: Server;

  constructor(
    private readonly configService: ConfigService,
    private readonly socketAuthMiddleware: SocketAuthMiddleware,
  ) {}

  async onModuleInit() {
    try {
      // Create Redis clients for pub/sub
      this.redisPubClient = createClient({
        url: this.configService.get(ENV.REDIS_URL),
        socket: {
          reconnectStrategy: (retries) => Math.min(retries * 100, 5000),
        },
      });
      this.redisSubClient = this.redisPubClient.duplicate();

      this.redisPubClient.on('error', (err) =>
        this.logger.error('Redis Pub Client Error', err, LOGGER_CONTEXT.GATEWAYS),
      );
      this.redisSubClient.on('error', (err) =>
        this.logger.error('Redis Sub Client Error', err, LOGGER_CONTEXT.GATEWAYS),
      );

      await Promise.allSettled([this.redisPubClient.connect(), this.redisSubClient.connect()]);

      this.logger.log('Redis clients connected successfully', LOGGER_CONTEXT.GATEWAYS);
    } catch (error) {
      this.logger.error('Redis connection failed', error, LOGGER_CONTEXT.GATEWAYS);
      throw error;
    }
  }

  afterInit() {
    // Attach the Redis adapter to the server
    if (this.redisPubClient && this.redisSubClient) {
      this.server.adapter(createAdapter(this.redisPubClient, this.redisSubClient));
      this.logger.log('Redis adapter attached to server', LOGGER_CONTEXT.GATEWAYS);
    }

    this.server.use((socket, next) => this.socketAuthMiddleware.use(socket, next));
    this.logger.log(`${WebsocketGateway.name}: Initialized`, LOGGER_CONTEXT.GATEWAYS);
  }

  handleConnection(client: Socket) {
    this.socketClients.add(client);
    this.logger.log(
      `${WebsocketGateway.name}: Client connected ${client.id}`,
      LOGGER_CONTEXT.GATEWAYS,
    );
  }

  handleDisconnect(client: Socket) {
    this.socketClients.delete(client);
    this.logger.log(
      `${WebsocketGateway.name}: Client disconnected ${client.id}`,
      LOGGER_CONTEXT.GATEWAYS,
    );
  }
}
