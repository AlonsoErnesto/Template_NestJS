import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../models/tables/user.entity';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { CategoriesModule } from '../modules/categories.module';
import { ArticlesModule } from '../modules/articles.module';
import { UsersModule } from '../modules/users.module';
import { AuthController } from './auth.controller';
import { LocalStrategy } from './strategies/local.strategy';
import { BodyImageModule } from '../modules/body-images.module';
import { CommentsModule } from '../modules/comments.module';
import { GoogleStrategy } from './strategies/google.strategy';
import { KakaoStrategy } from '../auth/strategies/kakao.strategy';
import { AlarmsModule } from '../modules/alarms.module';

@Module({
  imports: [
    PassportModule.register({ session: false }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return {
          secret: configService.get('ACCESS_KEY'),
          signOptions: { algorithm: 'HS256', expiresIn: '1y' },
        };
      },
    }),
    TypeOrmModule.forFeature([UserEntity]),
    UsersModule,
    CategoriesModule,
    ArticlesModule,
    BodyImageModule,
    CommentsModule,
    AlarmsModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
      JwtStrategy,
      LocalStrategy,
      //  GoogleStrategy,
      // KakaoStrategy
      ],
  exports: [AuthService],
})
export class AuthModule {}
