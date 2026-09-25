import * as Joi from 'joi';

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
  JWT_EXPIRES_IN: Joi.string().default('1h'),
  JWT_REFRESH_SECRET: Joi.string().min(8).default('change_me_refresh_in_dev'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('10h'),
  CORS_ORIGIN: Joi.string().required(),
  API_PUBLIC_BASE_URL: Joi.string().required(),
  STATIC_IMAGES_PATH: Joi.string().required(),
  FORMATOS_HC_PATH: Joi.string().required(),
  FIRMA_ENTIDAD_PATH: Joi.string().required(),
  DOCUMENTOS_PATH: Joi.string().required(),

  // IHCE / RDACE: opcionales hasta portar persistencia RDA
  IHCE_SANDBOX_BASE_URL: Joi.string().allow('').optional(),
  IHCE_SANDBOX_TENANT_ID: Joi.string().allow('').optional(),
  IHCE_SANDBOX_CLIENT_ID: Joi.string().allow('').optional(),
  IHCE_SANDBOX_CLIENT_SECRET: Joi.string().allow('').optional(),
  IHCE_SANDBOX_SCOPE: Joi.string().allow('').optional(),
  IHCE_SANDBOX_SUBSCRIPTION_KEY: Joi.string().allow('').optional(),
  IHCE_SANDBOX_CUSTODIAN_REPS: Joi.string().allow('').optional(),
  IHCE_SANDBOX_CUSTODIAN_NIT: Joi.string().allow('').optional(),
  IHCE_SANDBOX_CUSTODIAN_NAME: Joi.string().allow('').optional(),
  IHCE_PROD_BASE_URL: Joi.string().allow('').optional(),
  IHCE_PROD_TENANT_ID: Joi.string().allow('').optional(),
  IHCE_PROD_CLIENT_ID: Joi.string().allow('').optional(),
  IHCE_PROD_CLIENT_SECRET: Joi.string().allow('').optional(),
  IHCE_PROD_SCOPE: Joi.string().allow('').optional(),
  IHCE_PROD_SUBSCRIPTION_KEY: Joi.string().allow('').optional(),
  IHCE_PROD_CUSTODIAN_NIT: Joi.string().allow('').optional(),
  IHCE_PROD_CUSTODIAN_REPS: Joi.string().allow('').optional(),
  IHCE_PROD_CUSTODIAN_NAME: Joi.string().allow('').optional(),
  IHCE_RDACE_DEFAULT_NIT_IPS: Joi.string().allow('').optional(),
  IHCE_RDACE_DEFAULT_NOMBRE_IPS: Joi.string().allow('').optional(),
});
