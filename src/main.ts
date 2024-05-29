import { ClassSerializerInterceptor } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.fiter';
import { SwaggerSetting } from './config/swagger';
import compression from 'compression';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.use(compression());
  app.enableCors();

  SwaggerSetting(app);

  await app.listen(3000, '0.0.0.0', () => {
    if (process.env.NODE_ENV === 'production') {
      /**
       * If you don't know method ?. operator,
       * just read below link.
       *
       * @link {https://stackoverflow.com/questions/56913963/cannot-invoke-an-object-which-is-possibly-undefined-ts2722}
       */
      process.send?.('ready');
    }
  });
}

bootstrap();
