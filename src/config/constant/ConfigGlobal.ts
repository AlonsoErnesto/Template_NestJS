import { ConfigModule as Config } from '@nestjs/config';
import * as Joi from 'joi';

export const ConfigGlobalModule = Config.forRoot({
  isGlobal: true,
  validationSchema: Joi.object({
    //   MONGODB_URI: Joi.string().required(),
    //   JWT_SECRET: Joi.string().required(),
    //   JWT_EXPIRATION: Joi.string().required(),
    //  ACCESS_KEY: Joi.string().required()
    ACCESS_KEY: Joi.string().required(),
    //   TCP_PORT: Joi.number().required(),
  }),
});
