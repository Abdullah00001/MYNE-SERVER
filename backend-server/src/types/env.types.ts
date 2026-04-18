type TEnv = {
  DATABASE_URL: string;
  NODE_ENV: string;
  JWT_ACCESS_TOKEN_SECRET_KEY: string;
  JWT_REFRESH_TOKEN_SECRET_KEY: string;
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_USER: string;
  SMTP_PASS: string;
  OTP_HASH_SECRET: string;
  REDIS_HOST: string;
  REDIS_PASSWORD: string;
  REDIS_PORT: number;
  JWT_VERIFY_OTP_PAGE_SECRET_KEY: string;
  S3_ACCESS_KEY: string;
  S3_SECRET_KEY: string;
  S3_REGION: string;
  S3_BUCKET_NAME: string;
  EXCHANGE_RATE_API_KEY: string;
  AI_SERVER_URL:string;
};

export default TEnv;
