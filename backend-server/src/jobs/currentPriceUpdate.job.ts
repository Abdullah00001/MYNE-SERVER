import { schedule } from 'node-cron';
import { container } from 'tsyringe';

import { logger } from '@/configs';
import UserCollection from '@/modules/userBag/userBag.model';
import { PublishStatus } from '@/modules/userBag/userBag.types';
import { PriceSyncQueue } from '@/queue/queues/priceSync.queue';

const getPriceSyncQueue = (): PriceSyncQueue =>
  container.resolve(PriceSyncQueue);

const performPriceUpdate = async (): Promise<void> => {
  try {
    const now = new Date();
    const day = now.getDate();
    const month = now.getMonth();
    const year = now.getFullYear();

    // Determine update type based on day
    let updateType: 'CURRENT' | 'HISTORICAL';
    if (day === 1 || day === 10 || day === 20) {
      updateType = 'CURRENT';
    } else if (day === new Date(year, month + 1, 0).getDate()) {
      // Last day of the month
      updateType = 'HISTORICAL';
    } else {
      logger.info('[PriceUpdate] No update scheduled for today');
      return;
    }

    logger.info(
      `[PriceUpdate] Starting ${updateType} price update for all published bags`
    );

    // Get all published bags with populated brand and model
    const publishedBags = await UserCollection.find({
      publishStatus: PublishStatus.PUBLISHED,
    })
      .populate('brandId', 'brandName')
      .populate('modelId', 'modelName')
      .select(
        '_id brandId modelId bagColor condition material hardwareColor size variant'
      );

    if (publishedBags.length === 0) {
      logger.info('[PriceUpdate] No published bags found');
      return;
    }

    logger.info(
      `[PriceUpdate] Found ${publishedBags.length} published bags to update`
    );

    const priceSyncQueue = getPriceSyncQueue();

    // Add jobs to queue
    const jobPromises = publishedBags.map(async (bag) => {
      const jobData = {
        bagId: bag._id.toString(),
        brand: (bag.brandId as any).brandName,
        model: (bag.modelId as any).modelName,
        color: bag.bagColor,
        condition: bag.condition,
        leather: bag.material,
        hardware: bag.hardwareColor,
        size: bag.size,
        updateType,
        variant:bag.variant
      };

      await priceSyncQueue.addPriceSyncJob(jobData);
    });

    await Promise.all(jobPromises);

    logger.info(
      `[PriceUpdate] Successfully queued ${publishedBags.length} price update jobs`
    );
  } catch (error) {
    logger.error(
      '[PriceUpdate] Job failed:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    throw error;
  }
};

// Schedule to run daily at midnight
schedule('0 0 * * *', () => {
  performPriceUpdate().catch((error) => {
    logger.error(
      '[PriceUpdate] Unhandled error in cron job:',
      error instanceof Error ? error.message : 'Unknown error'
    );
  });
});
