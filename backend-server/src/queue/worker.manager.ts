// queue/worker.manager.ts
import { injectable, injectAll } from 'tsyringe';

import { BaseWorker } from '@/core/base_classes/worker.base';
import { WORKER_TOKEN } from '@/core/tokens/worker.token';

@injectable()
export class WorkerManager {
  constructor(
    @injectAll(WORKER_TOKEN)
    private readonly workers: BaseWorker[]
  ) {}

  async shutdown(): Promise<void> {
    await Promise.all(this.workers.map((w) => w.close()));
  }
}
