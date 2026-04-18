// core/base_classes/worker.base.ts
import { Worker, Job } from 'bullmq';

import { getRedisClient } from '@/configs/redis.config';

export abstract class BaseWorker<T = unknown> {
  protected worker: Worker;

  protected constructor(
    queueName: string,
    processor: (job: Job<T>) => Promise<void>
  ) {
    this.worker = new Worker(queueName, processor, {
      connection: getRedisClient(),
    });

    this.worker.on('completed', (job) => {
      console.log(`[Worker:${queueName}] Job completed`, job.id);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`[Worker:${queueName}] Job failed`, job?.id, err.message);
    });
  }

  async close(): Promise<void> {
    await this.worker.close();
  }
}
