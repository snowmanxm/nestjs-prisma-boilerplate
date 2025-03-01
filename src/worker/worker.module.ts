import { Logger, MiddlewareConsumer, Module } from '@nestjs/common';

import { CoreModule } from '@/core/core.module';
import { HealthcheckModule } from '@/core/healthcheck/healthcheck.module';
import { RequestLoggerMiddleware } from '@/shared/middlewares';

import { AuthModule } from './auth/auth.module';

@Module({
  imports: [AuthModule, CoreModule, HealthcheckModule],
  controllers: [],
  providers: [Logger],
})
export class WorkerModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
