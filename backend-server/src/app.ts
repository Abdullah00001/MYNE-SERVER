import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Application, Request, Response,json,urlencoded } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import corsConfiguration from '@/configs/cors.config';
import { morganMessageFormat, streamConfig } from '@/configs/morgan.config';
import { baseUrl } from '@/const';
import { globalErrorMiddleware } from '@/middlewares/globalError.middlewares';
import v1Routes from '@/routes/v1/index';


const app: Application = express();

app.use(json({limit:'10mb'}));
app.use(urlencoded({ extended: true, limit: '10mb' }));
app.set('trust proxy', 1);
app.use(cookieParser());
app.use(cors(corsConfiguration));
app.use(
  morgan(morganMessageFormat, {
    stream: {
      write: (message: string) => streamConfig(message),
    },
  })
);
app.use(helmet());

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ message: 'Server Is Running' });
});

/* ====================================|
|--------------APP ROUTES--------------|
|==================================== */

// V1 ROUTES
app.use(baseUrl.v1, v1Routes);

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    error: `Cannot ${req.method} ${req.originalUrl}`,
  });
});
app.use(globalErrorMiddleware);

export default app;
