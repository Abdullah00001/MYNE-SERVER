import { injectable, injectAll } from 'tsyringe';

import { BaseQueue } from '@/core/base_classes/queue.base';
import { QUEUE_TOKEN } from '@/core/tokens/queue.token';

@injectable()
export class QueueManager {
  constructor(
    @injectAll(QUEUE_TOKEN)
    private readonly queues: BaseQueue[]
  ) {}

  async shutdown(): Promise<void> {
    await Promise.all(this.queues.map((queue) => queue.close()));
  }
}
