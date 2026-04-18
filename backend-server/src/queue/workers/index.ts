import { container } from 'tsyringe';

import { EmailWorker } from '@/queue/workers/email.worker';
import { PriceSyncWorker } from '@/queue/workers/priceSync.worker';

/**
 * Worker bootstrap
 * Importing this file starts all workers
 */

export const startWorkers = (): void => {
  container.resolve(EmailWorker);
  container.resolve(PriceSyncWorker);
};
