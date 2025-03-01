import { BullModule } from '@nestjs/bullmq';
import { CacheModule } from '@nestjs/cache-manager';
import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisClusterStore, redisStore } from 'cache-manager-redis-yet';
import Redis from 'ioredis';
import { URL } from 'url';

import { Configuration } from '@/shared/config';
import { CACHE_TYPE, ENV, FLOW, QUEUE } from '@/shared/enums';

import { DatabaseModule } from './database/database.module';
import { QueueModule } from './queue/queue.module';
import { UploadModule } from './upload/upload.module';

@Global()
@Module({
  imports: [
    DatabaseModule,
    UploadModule,
    ConfigModule.forRoot({ isGlobal: true, load: [Configuration] }),
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      isGlobal: true,
      useFactory: async (configService: ConfigService) => {
        const cacheMode = configService.get(ENV.CACHE_MODE);
        const prefix = `{\`${configService.get(ENV.APP_NAME)}\`}:${configService.get(ENV.APP_ENV)}`;
        const redisMode = configService.get('REDIS_MODE');
        const url = configService.get(ENV.REDIS_URL);

        return cacheMode === CACHE_TYPE.REDIS
          ? {
              store:
                redisMode === 'single'
                  ? await redisStore({
                      url,
                      keyPrefix: prefix,
                    })
                  : await redisClusterStore({
                      rootNodes: [{ url }],
                      useReplicas: true,
                      keyPrefix: prefix,
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    } as any),
              ttl: +configService.get(ENV.CACHE_TTL),
            }
          : {
              ttl: +configService.get(ENV.CACHE_TTL),
            };
      },
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const prefix = `{\`${configService.get(ENV.APP_NAME)}\`}:${configService.get(ENV.APP_ENV)}`;
        const redisMode = configService.get('REDIS_MODE');
        const url = configService.get(ENV.REDIS_URL);
        const parsedUrl = new URL(url);

        const host = parsedUrl.hostname;
        const port = parseInt(parsedUrl.port, 10);

        return {
          connection: redisMode === 'single' ? { url } : new Redis.Cluster([{ host, port }]),
          defaultJobOptions: {
            removeOnComplete: {
              age: 3600,
              count: 100,
            },
            removeOnFail: {
              age: 3600,
              count: 100,
            },
            attempts: 3,
          },
          prefix,
        };
      },
    }),
    QueueModule.register({
      queues: Object.values(QUEUE),
      flows: Object.values(FLOW),
    }),
  ],

  providers: [Logger, ConfigService],
  exports: [DatabaseModule, UploadModule, QueueModule, Logger, ConfigService],
})
export class CoreModule {}
