// queue/queues/priceSync.queue.ts

import { injectable } from 'tsyringe';

import { BaseQueue } from '@/core/base_classes/queue.base';

export interface IPriceSyncJobData {
  bagId: string;
  brand: string;
  model: string;
  color: string;
  condition: string;
  leather: string;
  hardware: string;
  size: string;
  updateType: 'CURRENT' | 'HISTORICAL';
}

@injectable()
export class PriceSyncQueue extends BaseQueue {
  constructor() {
    super('price-sync-queue');
  }

  async addPriceSyncJob(data: IPriceSyncJobData): Promise<void> {
    await this.queue.add('price-sync', data);
  }
}