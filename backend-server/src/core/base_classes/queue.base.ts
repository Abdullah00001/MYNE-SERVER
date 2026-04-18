import { Queue } from 'bullmq';

import { createQueueOptions } from '@/configs/queue.configs';

export abstract class BaseQueue {
  protected readonly queue: Queue;

  protected constructor(queueName: string) {
    this.queue = new Queue(queueName, createQueueOptions());
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}
