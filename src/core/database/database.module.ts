import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { ENV } from '@/shared/enums';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        return {
          uri: configService.get<string>(ENV.DATABASE_URL),
        };
      },
    }),
  ],
  exports: [MongooseModule],
})
export class DatabaseModule {}
