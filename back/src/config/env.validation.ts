import * as Joi from 'joi';
import * as path from 'path';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3001),
  DB_SERVER: Joi.string().required(),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().allow('').required(),
  DB_NAME: Joi.string().required(),
  DB_PORT: Joi.number().default(1433),
  DB_ENCRYPT: Joi.string().valid('true', 'false').default('false'),
  DB_TRUST_SERVER_CERTIFICATE: Joi.string()
    .valid('true', 'false')
    .default('true'),
  JWT_SECRET: Joi.string().min(8).default('change_me_in_dev_only'),
  JWT_EXPIRES_IN: Joi.string().default('10h'),
  CORS_ORIGIN: Joi.string().default('http://localhost:5173'),
  API_PUBLIC_BASE_URL: Joi.string().default('http://localhost:3001'),
  STATIC_IMAGES_PATH: Joi.string().default(
    path.join(__dirname, '../../assets/static-images'),
  ),
  FORMATOS_HC_PATH: Joi.string().default('C:/CeereSio/Formatos HC'),
  FIRMA_ENTIDAD_PATH: Joi.string().default('C:/CeereSio/Firma Entidad'),
  DOCUMENTOS_PATH: Joi.string().default('C:/CeereSio/Documentos'),
});
