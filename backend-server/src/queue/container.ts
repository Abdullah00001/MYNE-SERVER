import { container } from 'tsyringe';

import { QUEUE_TOKEN } from '@/core/tokens/queue.token';
import { WORKER_TOKEN } from '@/core/tokens/worker.token';
import { EmailQueue } from '@/queue/queues/email.queue';
import { PriceSyncQueue } from '@/queue/queues/priceSync.queue';
import { EmailWorker } from '@/queue/workers/email.worker';
import { PriceSyncWorker } from '@/queue/workers/priceSync.worker';

container.register(QUEUE_TOKEN, { useClass: EmailQueue });
container.register(QUEUE_TOKEN, { useClass: PriceSyncQueue });
container.register(WORKER_TOKEN, {
  useClass: EmailWorker,
});
container.register(WORKER_TOKEN, {
  useClass: PriceSyncWorker,
});
