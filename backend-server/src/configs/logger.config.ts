import { createLogger, format, transports } from 'winston';

const { printf, timestamp, combine, json, colorize } = format;

const loggerFormat = printf(({ timestamp, message, level }) => {
  return `${timestamp} ${level} ${message}`;
});

const logger = createLogger({
  level: 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    colorize(),
    json(),
    loggerFormat
  ),
  transports: [
    new transports.Console(),
    new transports.File({
      filename: 'logs/combine.log',
      format: combine(json()),
    }),
    new transports.File({
      level: 'info',
      filename: 'logs/info.log',
      format: combine(json()),
    }),
    new transports.File({
      level: 'error',
      filename: 'logs/error.log',
      format: combine(json()),
    }),
  ],
});

export default logger;
