import logger from '@/configs/logger.config';

interface LogObject {
  method: string;
  url: string;
  status: string;
  res: string;
  responseTime: string;
}

const morganMessageFormat =
  '":method :url HTTP/:http-version" :status :res[content-length] :response-time ms';

const streamConfig = (message: string): void => {
  const parts = message.match(/"([^"]+)" (\d+) (\d+|-) ([\d.]+ ms)/);
  if (parts) {
    const logObject: LogObject = {
      method: parts[1].split(' ')[0],
      url: parts[1].split(' ')[1],
      status: parts[2],
      res: parts[3] === '-' ? '0' : parts[3],
      responseTime: parts[4],
    };

    logger.info(
      `Method: ${logObject.method}, URL: ${logObject.url}, Status: ${logObject.status}, Res: ${logObject.res}, Response Time: ${logObject.responseTime}`
    );
  }
};

export { morganMessageFormat, streamConfig };
