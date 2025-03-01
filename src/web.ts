import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import 'reflect-metadata';
import 'winston-daily-rotate-file';

import { ENV, LOGGER_TYPE } from './shared/enums';
import { getWinstronLogger } from './shared/helpers';
import { setupSwagger } from './swagger';
import { WebModule } from './web/web.module';

async function bootstrap() {
  const web = await NestFactory.create(WebModule);

  const configService = web.get(ConfigService);

  if (configService.get<string>(ENV.LOGGER_TYPE) === LOGGER_TYPE.WINSTON) {
    const maxFiles = configService.get(ENV.LOGGER_MAX_FILES);
    const datePattern = 'YYYY-MM-DD';
    const logLevel = configService.get(ENV.LOGGER_LEVEL);
    const dbUrl = configService.get(ENV.LOGGER_DATABASE_URL);
    web.useLogger(getWinstronLogger(maxFiles, datePattern, 'App', logLevel, dbUrl, 'web'));
  }

  web.useGlobalPipes(
    new ValidationPipe({
      transform: true,
    }),
  );

  setupSwagger(web);

  const port = configService.get(ENV.APP_PORT);
  await web.listen(port);

  const logger = new Logger();
  logger.log(`Application is running on: ${await web.getUrl()}`);
}
bootstrap();
