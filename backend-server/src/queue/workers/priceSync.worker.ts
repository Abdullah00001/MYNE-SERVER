// queue/workers/priceSync.worker.ts
import { Job } from 'bullmq';
import { injectable } from 'tsyringe';
import axios from 'axios';

import { BaseWorker } from '@/core/base_classes/worker.base';
import { env } from '@/env';
import { logger } from '@/configs';
import UserCollection from '@/modules/userBag/userBag.model';
import { monthNameMap } from '@/const';
import { SystemUtils } from '@/utils/system.utils';
import { IPriceSyncJobData } from '@/queue/queues/priceSync.queue';
import {
  Currency,
  TAdminBagPriceStatus,
} from '@/modules/adminBag/adminBag.types';
import { IYearValue } from '@/modules/userBag/userBag.types';

@injectable()
export class PriceSyncWorker extends BaseWorker {
  constructor(private readonly systemUtils: SystemUtils) {
    super('price-sync-queue', async (job: Job) => {
      await this.process(job);
    });
  }

  private async process(job: Job<IPriceSyncJobData>): Promise<void> {
    const { primaryImage, updateType, imageSearchQuery, bagId } = job.data;

    try {
      logger.info(
        `[PriceSyncWorker] Processing job for bag ${bagId} with updateType ${updateType}`
      );

      const plainResponse = await axios.post(
        `${env.AI_SERVER_URL}/bags/price/by-image`,
        {
          image_url: primaryImage,
          image_search_query: imageSearchQuery,
        }
      );

      const aiData = plainResponse.data?.data;
      const priceHistory: { period: string; avg_price: number }[] =
        aiData?.price_history?.history ?? [];
      const currency: Currency = aiData?.currency ?? null;

      const updateFields: {
        priceStatus?: TAdminBagPriceStatus;
        historicalValue?: Record<string, IYearValue>;
      } = {};

      /* ---------------------------- priceStatus build --------------------------- */
      updateFields.priceStatus = {
        trend: aiData?.trend ?? null,
        changePercentage: aiData?.change_percentage ?? null,
        currentMinValue: aiData?.price_range?.min ?? null,
        currentMaxValue: aiData?.price_range?.max ?? null,
        currency,
        fetchedAt: new Date().toISOString(),
      };

      if (updateType === 'HISTORICAL') {
        /* -------------------------- historicalValue build ------------------------- */
        // Get current historicalValue
        const bag = await UserCollection.findById(bagId)
          .select('historicalValue')
          .lean();
        const historicalValue: Record<string, IYearValue> = JSON.parse(
          JSON.stringify(bag?.historicalValue ?? {})
        );

        for (const entry of priceHistory) {
          const [monthAbbr, year] = entry.period.split(' ');
          const monthKey = monthNameMap[monthAbbr];

          if (!monthKey || !year) continue;

          if (!historicalValue[year]) {
            historicalValue[year] = this.systemUtils.createEmptyYear();
          }

          historicalValue[year][monthKey] = {
            currency,
            avg_price: entry.avg_price,
          };
        }

        updateFields.historicalValue = historicalValue;
      }

      await UserCollection.updateOne(
        { _id: bagId },
        { $set: updateFields },
        { runValidators: true }
      );

      logger.info(`[PriceSyncWorker] Successfully updated bag ${bagId}`);
    } catch (error) {
      logger.error(
        `[PriceSyncWorker] Failed to process job for bag ${bagId}:`,
        error
      );
      throw error;
    }
  }
}
