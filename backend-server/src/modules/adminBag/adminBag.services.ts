import { extname, join } from 'path';

import { JwtPayload } from 'jsonwebtoken';
import { Types } from 'mongoose';
import { injectable } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

import { CreateAdminBagDTO } from '@/modules/adminBag/adminBag.dto';
import AdminBag from '@/modules/adminBag/adminBag.model';
import {
  IAdminBags,
  TActions,
  TGetAdminBagsResponse,
} from '@/modules/adminBag/adminBag.types';
import { TAdminBagPriceStatus } from '@/modules/adminBag/adminBag.model';
import { IUser } from '@/modules/auth/auth.types';
import { Role } from '@/types/jwt.types';
import { S3Utils } from '@/utils/s3.utils';
import { SystemUtils } from '@/utils/system.utils';
import { TCreateAdminBag } from '@/modules/adminBag/adminBag.schemas';
import { env } from '@/env';
import { Currency } from '@/modules/adminBag/adminBag.types';
import UserCollection from '@/modules/userBag/userBag.model';
import {
  IUserBag,
  IYearValue,
  PublishStatus,
  ValuationResponse,
} from '@/modules/userBag/userBag.types';
import Brand from '@/modules/brand/brand.model';
import ModelModel from '@/modules/model/model.model';
import { monthNameMap } from '@/const';
import { IBrand } from '@/modules/brand/brand.types';
import { IModel } from '@/modules/model/model.types';
import { getRedisClient } from '@/configs/redis.config';

@injectable()
export class AdminBagService {
  constructor(
    private readonly s3Utils: S3Utils,
    private readonly systemUtils: SystemUtils
  ) {}

  async createAdminBag({
    payload,
    file,
    user,
  }: {
    payload: TCreateAdminBag;
    file: string;
    user: JwtPayload;
  }): Promise<unknown> {
    const {
      brandId,
      bagColor,
      modelId,
      material,
      hardwareColor,
      size,
      condition,
      variant,
      specialVariant,
      yearsOfBag,
      wearChecklist,
    } = payload;
    const aiFields: {
      priceStatus?: TAdminBagPriceStatus;
      historicalValue?: Record<string, IYearValue>;
    } = {};
    const redisClient = getRedisClient();
    const filePath = join(__dirname, '../../../public/temp', file);
    const mimeType = extname(filePath);
    const key = `admin-bags/${uuidv4()}/${Date.now()}${mimeType}`;
    try {
      const image = await this.s3Utils.singleUpload({
        filePath,
        key,
        mimeType,
      });
      const brand = await Brand.findById(brandId).lean();
      const model = await ModelModel.findById(modelId).lean();
      const imageSQuery = this.systemUtils.buildImageSearchQuery({
        brand: brand?.brandName as string,
        model: model?.modelName as string,
        bagColor,
        condition,
        hardwareColor,
        material,
        size,
        specialVariant,
        variant,
      });
      const plainResponse = await axios.post(
        `${env.AI_SERVER_URL}/bags/price/by-image`,
        {
          image_url: image,
          image_search_query: imageSQuery,
          purchase_price: null,
        }
      );
      const aiResponsePayload = plainResponse.data?.data;
      const priceHistory: { period: string; avg_price: number }[] =
        aiResponsePayload?.price_history?.history ?? [];
      const currency: Currency = aiResponsePayload?.currency ?? null;
      /* ---------------------------- priceStatus build --------------------------- */

      aiFields.priceStatus = {
        trend: aiResponsePayload?.trend ?? null,
        changePercentage: aiResponsePayload?.change_percentage ?? null,
        currentMinValue: aiResponsePayload?.price_range?.min ?? null,
        currentMaxValue: aiResponsePayload?.price_range?.max ?? null,
        currency,
        fetchedAt: new Date().toISOString(),
      };

      /* -------------------------- historicalValue build ------------------------- */

      const historicalValue: Record<string, IYearValue> = {} as Record<
        string,
        IYearValue
      >;
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

      aiFields.historicalValue = historicalValue;
      const newBag = new UserCollection({
        userId: user.sub,
        brandId,
        bagColor,
        modelId,
        material,
        hardwareColor,
        size,
        condition,
        variant,
        specialVariant,
        yearsOfBag,
        wearChecklist,
        imageSearchQuery: imageSQuery,
        ...aiFields,
        primaryImage: image,
        thumbnailImage: image,
        images: [image],
        isAdmin: true,
        publishStatus: PublishStatus.PUBLISHED,
      });
      await redisClient.set(
        `bag-price-${newBag._id}`,
        JSON.stringify(aiResponsePayload),
        'PX',
        24 * 60 * 60 * 1000
      );
      await newBag.save();
      return newBag;
    } catch (error) {
      await this.s3Utils.singleDelete({ key });
      if (error instanceof Error) throw error;
      throw new Error('Unknown Error Occurred In Admin Bag Creation Service');
    }
  }

  async getAdminBags({
    page,
    limit,
    user,
  }: {
    page?: string;
    limit?: string;
    user: JwtPayload | IUser;
  }): Promise<TGetAdminBagsResponse> {
    try {
      const queryPage = parseInt(page || '1', 10);
      const queryLimit = parseInt(limit || '10', 10);
      const isAdmin = user.role === Role.ADMIN;
      const skip = (queryPage - 1) * queryLimit;
      const [result] = await UserCollection.aggregate([
        // ── Filter admin bags only, using your existing isAdmin flag ──────────
        { $match: { isAdmin: true } },

        {
          $facet: {
            data: [
              { $sort: { createdAt: -1 } },
              { $skip: skip },
              { $limit: queryLimit },

              // Join brand
              {
                $lookup: {
                  from: 'brands',
                  localField: 'brandId', // ✅ your actual field name
                  foreignField: '_id',
                  as: 'brandData',
                },
              },
              {
                $unwind: {
                  path: '$brandData',
                  preserveNullAndEmptyArrays: true,
                },
              },

              // Join model
              {
                $lookup: {
                  from: 'models',
                  localField: 'modelId', // ✅ your actual field name
                  foreignField: '_id',
                  as: 'modelData',
                },
              },
              {
                $unwind: {
                  path: '$modelData',
                  preserveNullAndEmptyArrays: true,
                },
              },

              // ── Only return the minimum fields needed ─────────────────────────
              {
                $project: {
                  primaryImage: 1,
                  priceStatus: 1, // current value, currency, trend
                  brand: {
                    _id: '$brandData._id',
                    brandName: '$brandData.brandName',
                    brandLogo: '$brandData.brandLogo',
                  },
                  model: {
                    _id: '$modelData._id',
                    modelName: '$modelData.modelName',
                    modelImage: '$modelData.modelImage',
                  },
                },
              },
            ],

            totalCount: [{ $count: 'count' }],
          },
        },

        // Flatten totalCount from [{count: N}] → N
        {
          $addFields: {
            totalCount: {
              $ifNull: [{ $arrayElemAt: ['$totalCount.count', 0] }, 0],
            },
          },
        },
      ]);

      const rawData = result.data || [];
      const total = result.totalCount[0]?.count || 0;
      const totalPages = Math.ceil(total / queryLimit);
      const data = rawData;

      // Calculate showing range
      const from = total === 0 ? 0 : skip + 1;
      const to = Math.min(skip + queryLimit, total);
      const showing = `Showing ${from} to ${to} of ${total} results`;
      // Determine base path based on user role
      const basePath = user.role === 'admin' ? '/admin/model' : '/model';

      const actions: TActions = {
        create: isAdmin
          ? {
              href: `${basePath}`,
              method: 'POST',
            }
          : undefined,
        delete:
          isAdmin && data.length > 0
            ? {
                href: `${basePath}/:id`,
                method: 'DELETE',
              }
            : undefined,
      };

      // If no data, return null for links
      if (data.length === 0) {
        return {
          data,
          meta: {
            total,
            page: queryPage,
            limit: queryLimit,
            totalPages,
            links: null,
            actions,
            showing,
          },
        };
      }

      // Helper function to build links
      const buildLink = (pageNum: number): string => {
        const query = new URLSearchParams();
        query.set('page', pageNum.toString());
        query.set('limit', queryLimit.toString());
        return `${basePath}?${query.toString()}`;
      };

      return {
        data,
        meta: {
          total,
          page: queryPage,
          limit: queryLimit,
          totalPages,
          links: {
            first: buildLink(1),
            last: buildLink(totalPages),
            previous: queryPage > 1 ? buildLink(queryPage - 1) : null,
            next: queryPage < totalPages ? buildLink(queryPage + 1) : null,
            current: buildLink(queryPage),
          },
          actions,
          showing,
        },
      };
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('Unknown Error Occurred In Fetching Admin Bags Service');
    }
  }

  async getOneAdminBag({
    collection,
    period,
  }: {
    collection: IUserBag;
    period: string;
  }) {
    try {
      const redisClient = getRedisClient();

      const STATIC_PERIODS = ['3 months', '6 months', '1 year'] as const;
      const MONTH_NAMES = [
        'january',
        'february',
        'march',
        'april',
        'may',
        'june',
        'july',
        'august',
        'september',
        'october',
        'november',
        'december',
      ];

      const now = new Date();
      const currentYear = now.getFullYear();

      // End point is always current month - 1
      const endMonthIndex = now.getMonth() - 1;
      const endDate = new Date(currentYear, endMonthIndex, 1);
      const endYear = endDate.getFullYear();
      const endMonth = endDate.getMonth();

      // ─── Helper: build month slice ───────────────────────────────────────────
      const buildMonthSlice = (
        count: number
      ): { year: number; month: number }[] => {
        const slice: { year: number; month: number }[] = [];
        for (let i = count - 1; i >= 0; i--) {
          const date = new Date(endYear, endMonth - i, 1);
          slice.push({ year: date.getFullYear(), month: date.getMonth() });
        }
        return slice;
      };

      // ─── Determine month count from period ──────────────────────────────────
      const periodToMonthCount: Record<string, number> = {
        '3 months': 3,
        '6 months': 6,
        '1 year': 12,
      };

      // ─── Slice historical value from raw document ────────────────────────────
      const sliceHistoricalValue = (
        historicalValue: Record<string, Record<string, unknown>>,
        slice: { year: number; month: number }[]
      ) => {
        const result: Record<string, Record<string, unknown>> = {};
        for (const { year, month } of slice) {
          const yearKey = year.toString();
          const monthKey = MONTH_NAMES[month];
          const monthData = historicalValue?.[yearKey]?.[monthKey];
          if (monthData !== undefined) {
            if (!result[yearKey]) result[yearKey] = {};
            result[yearKey][monthKey] = monthData;
          }
        }
        return result;
      };

      // ─── Build available period options for frontend ─────────────────────────
      const buildAvailablePeriods = (
        historicalValue: Record<string, Record<string, unknown>>
      ): string[] => {
        const yearsInDb = Object.keys(historicalValue ?? {})
          .map(Number)
          .filter((y) => y < currentYear)
          .sort((a, b) => b - a);

        return [...STATIC_PERIODS, ...yearsInDb.map(String)];
      };

      // ─── Aggregation (without historicalValue slicing — done in JS) ──────────
      const [result] = await UserCollection.aggregate([
        {
          $match: { _id: collection._id, isAdmin: true },
        },
        {
          $lookup: {
            from: 'brands',
            localField: 'brandId',
            foreignField: '_id',
            as: 'brandId',
          },
        },
        { $unwind: '$brandId' },
        {
          $lookup: {
            from: 'models',
            localField: 'modelId',
            foreignField: '_id',
            as: 'modelId',
          },
        },
        { $unwind: '$modelId' },
      ]);

      if (!result) throw new Error('Bag not found');

      // ─── Period resolution & historicalValue slicing ─────────────────────────
      const isStaticPeriod = STATIC_PERIODS.includes(
        period as (typeof STATIC_PERIODS)[number]
      );
      const isOldYearPeriod = !isStaticPeriod && /^\d{4}$/.test(period);

      let slicedHistoricalValue: Record<string, Record<string, unknown>> = {};

      if (isStaticPeriod) {
        const monthCount = periodToMonthCount[period];
        const slice = buildMonthSlice(monthCount);
        slicedHistoricalValue = sliceHistoricalValue(
          result.historicalValue,
          slice
        );
      } else if (isOldYearPeriod) {
        const yearKey = period;
        slicedHistoricalValue = result.historicalValue?.[yearKey]
          ? { [yearKey]: result.historicalValue[yearKey] }
          : {};
      } else {
        const slice = buildMonthSlice(12);
        slicedHistoricalValue = sliceHistoricalValue(
          result.historicalValue,
          slice
        );
      }

      const availablePeriods = buildAvailablePeriods(result.historicalValue);

      // ─── AI pricing (unchanged) ──────────────────────────────────────────────
      let aiResponsePayload: ValuationResponse;
      const cacheAiResponse = await redisClient.get(
        `bag-price-${collection._id}`
      );
      if (cacheAiResponse) {
        aiResponsePayload = JSON.parse(cacheAiResponse) as ValuationResponse;
      } else {
        const plainResponse = await axios.post(
          `${env.AI_SERVER_URL}/bags/price/by-image`,
          {
            image_url: collection.primaryImage,
            image_search_query: collection.imageSearchQuery,
            purchase_price: collection.purchasePrice,
          }
        );
        const freshAiResponsePayload = plainResponse.data?.data;
        await redisClient.set(
          `bag-price-${collection._id}`,
          JSON.stringify(freshAiResponsePayload),
          'PX',
          24 * 60 * 60 * 1000
        );
        aiResponsePayload = freshAiResponsePayload;
      }
      const allSites =
        aiResponsePayload?.sources_used?.flatMap(
          (s: { type: string; sites: string[] }) => s.sites
        ) ?? [];
      const marketSources: {
        eur: number;
        original: number;
        currency: string;
        source: string;
        url: string;
        title: string;
        country: string;
        condition: string;
      }[] = aiResponsePayload?.market_sources?.Search_Results || [];

      const priceStatus = {
        trend: aiResponsePayload?.trend ?? null,
        changePercentage: aiResponsePayload?.change_percentage ?? null,
        currentMinValue: aiResponsePayload?.price_range?.min ?? null,
        currentMaxValue: aiResponsePayload?.price_range?.max ?? null,
        currency: aiResponsePayload?.currency ?? null,
        fetchedAt: new Date().toISOString(),
      };

      return {
        ...result,
        historicalValue: slicedHistoricalValue,
        historicalValuePeriods: availablePeriods,
        aiSuggestedPrice:
          Math.round(
            (((priceStatus.currentMinValue ?? 0) +
              (priceStatus.currentMaxValue ?? 0)) /
              2) *
              100
          ) / 100,
        priceStatus,
        source: allSites,
        marketSources: marketSources,
      };
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('An Unexpected Error Occurred In Get One Bag Service');
    }
  }
}
