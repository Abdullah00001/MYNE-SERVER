import 'reflect-metadata';

import { createServer, Server } from 'node:http';

import {config} from 'dotenv';

import connectDatabase from '@/configs/db.config';
import { connectRedis, initializeRedis } from '@/configs/redis.config';
import registerContainers from '@/container';
import { startWorkers } from '@/queue/workers/index';
import { shutdown } from '@/utils/index';
import '@/queue/container';
import '@/jobs/index';

// dotenv config initialization
config();

initializeRedis();

// container initialization
registerContainers();

import app from '@/app';

const port: number = Number(process.env.PORT) || 5000;

const server: Server = createServer(app);

async function main(): Promise<void> {
  await connectDatabase();
  await connectRedis();
  startWorkers();
  server.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Server ready!`);
    console.log(`🏠 Local:   http://localhost:${port}`);
    console.log(`🌐 Network: http://10.10.10.28:${port}`);
  });
}

main();

/**
 * Graceful signals
 */
process.on('SIGINT', () => shutdown({ reason: 'SIGINT', server }));
process.on('SIGTERM', () => shutdown({ reason: 'SIGTERM', server }));

/**
 * Fatal errors
 */
process.on('unhandledRejection', (error) =>
  shutdown({ reason: 'unhandledRejection', server, error })
);

process.on('uncaughtException', (error) =>
  shutdown({ reason: 'uncaughtException', server, error })
);
