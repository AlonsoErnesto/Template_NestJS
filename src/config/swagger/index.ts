import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule } from '@nestjs/swagger';

import { readFileSync, existsSync } from 'fs';

import path from 'path';

export const SwaggerSetting = (app: INestApplication) => {
  const swaggerFilePath = path.join(__dirname, '../../dist/swagger.json');

  if (!existsSync(swaggerFilePath)) {
    console.error(`Swagger file not found: ${swaggerFilePath}`);
    return;
  }

  const swaggerConfig = readFileSync(swaggerFilePath, 'utf8');
  let swaggerDocument;

  try {
    swaggerDocument = JSON.parse(swaggerConfig);
  } catch (error) {
    console.error('Error parsing swagger.json:', error);
    return;
  }

  const configService = app.get(ConfigService);
  const env = configService.get('NODE_ENV');
  swaggerDocument.servers[0].url = configService.get(`${env}_SERVER_HOST`);

  SwaggerModule.setup('api/nestia', app, swaggerDocument);
  SwaggerModule.setup('api', app, swaggerDocument);
};
