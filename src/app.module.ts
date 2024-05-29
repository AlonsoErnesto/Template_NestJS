import { CacheModule, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { HttpExceptionFilter } from './common/filters/http-exception.fiter';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeOrmModuleOptions } from './config/typeorm';
import { AuthModule } from './auth/auth.module';
import { LoggerMiddleware } from './common/middlewares/logger.middleware';
import { SlackModule } from './external/slack/slack.module';
import { GraphQLModuleConfig } from './config/graphql/graphql.config';
import { ConfigGlobalModule } from './config/constant/ConfigGlobal';

@Module({
  imports: [
    TypeOrmModule.forRootAsync(TypeOrmModuleOptions),
    GraphQLModuleConfig,
    ConfigGlobalModule,
    ThrottlerModule.forRoot({ ttl: 60, limit: 60 }),
    CacheModule.register({ isGlobal: true }),
    SlackModule,
    AuthModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    ConfigService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
