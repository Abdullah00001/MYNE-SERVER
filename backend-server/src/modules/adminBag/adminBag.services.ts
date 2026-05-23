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
  TAdminBagPriceStatus,
  TGetAdminBagsResponse,
} from '@/modules/adminBag/adminBag.types';
import { IUser } from '@/modules/auth/auth.types';
import { Role } from '@/types/jwt.types';
import { S3Utils } from '@/utils/s3.utils';
import { SystemUtils } from '@/utils/system.utils';
import {
  TCreateAdminBagPayload,
  TUpdateAdminBagPayload,
} from '@/modules/adminBag/adminBag.schemas';
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
    payload: TCreateAdminBagPayload;
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
    const filePath = join(__dirname, '../../../public/temp', file);
    const mimeType = extname(filePath);
    const key = `admin-bags/${uuidv4()}/${Date.now()}${mimeType}`;
    try {
      const url = await this.s3Utils.singleUpload({
        filePath,
        key,
        mimeType,
      });
      const brand = await Brand.findOne({ _id: brandId });
      if (!brand) throw new Error('Brand Not Found');
      const model = await ModelModel.findOne({ _id: modelId });
      if (!model) throw new Error('Model Not Found');
      const imageSearchQuery = this.systemUtils.buildImageSearchQuery({
        brand: brand?.brandName,
        model: model?.modelName,
        bagColor,
        condition: condition,
        material,
        hardwareColor,
        size: size,
        variant,
        specialVariant,
      });
      const plainResponse = await axios.post(
        `${env.AI_SERVER_URL}/bags/price/by-image`,
        {
          image_url: url,
          image_search_query: imageSearchQuery,
          purchase_price: null,
        }
      );
      const aiData = plainResponse.data?.data;
      const priceHistory: { period: string; avg_price: number }[] =
        aiData?.price_history?.history ?? [];
      const currency: Currency = aiData?.currency ?? null;

      /* ---------------------------- priceStatus build --------------------------- */
      const marketSources: {
        eur: number;
        original: number;
        currency: string;
        source: string;
        url: string;
        title: string;
      }[] = aiData?.market_sources?.Search_Results || [];
      aiFields.priceStatus = {
        trend: aiData?.trend ?? null,
        changePercentage: aiData?.change_percentage ?? null,
        currentMinValue: aiData?.price_range?.min ?? null,
        currentMaxValue: aiData?.price_range?.max ?? null,
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
      const newAdminBag = new UserCollection({
        variant,
        brandId,
        modelId,
        bagColor,
        material,
        hardwareColor,
        size,
        condition,
        primaryImage: url,
        isAdmin: true,
        publishStatus: PublishStatus.PUBLISHED,
        specialVariant,
        imageSearchQuery,
        yearsOfBag,
        wearChecklist,
        // productionYear: priceData.productionYear,
        ...aiFields,
        userId: new Types.ObjectId(user._id as string),
      });
      await newAdminBag.save();
      return {
        ...newAdminBag,
        marketSources: marketSources.map((item) => item.url),
      };
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

  async deleteAdminBag({ bag }: { bag: IUserBag }): Promise<void> {
    try {
      const key = this.systemUtils.extractS3KeyFromUrl(bag.primaryImage);
      await this.s3Utils.singleDelete({ key });
      await UserCollection.findByIdAndDelete(bag._id);
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('Unknown Error Occurred In Admin Bag Deletion Service');
    }
  }

  async updateAdminBag({
    bag,
    file,
  }: {
    bag: IUserBag;
    file?: string;
  }): Promise<unknown> {
    let bagImage = bag.primaryImage;
    try {
      if (file) {
        if (bagImage) {
          const oldKey = this.systemUtils.extractS3KeyFromUrl(bagImage);
          await this.s3Utils.singleDelete({ key: oldKey });
        }
        const filePath = join(__dirname, '../../../public/temp', file);
        const mimeType = extname(filePath);
        const key = `admin-bags/${uuidv4()}/${Date.now()}${mimeType}`;
        bagImage = await this.s3Utils.singleUpload({
          filePath,
          key,
          mimeType,
        });
      }

      const data = await UserCollection.findByIdAndUpdate(
        bag._id,
        {
          primaryImage: bagImage,
        },
        { new: true }
      );
      if (!data) throw new Error('Admin Bag Not Found For Update');
      return data;
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('Unknown Error Occurred In Update Bag Service');
    }
  }

  async getOneAdminBag({
    collection,
    year,
  }: {
    collection: IUserBag;
    year?: string;
  }) {
    try {
      const targetYear = year ?? new Date().getFullYear().toString();

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
        {
          $unwind: '$brandId',
        },
        {
          $lookup: {
            from: 'models',
            localField: 'modelId',
            foreignField: '_id',
            as: 'modelId',
          },
        },
        {
          $unwind: '$modelId',
        },
        {
          $addFields: {
            // All available years as an array for frontend year picker
            historicalValueYears: {
              $map: {
                input: {
                  $objectToArray: { $ifNull: ['$historicalValue', {}] },
                },
                as: 'entry',
                in: '$$entry.k',
              },
            },
            // Only the selected year's full month data
            historicalValue: {
              $cond: {
                if: { $ifNull: [`$historicalValue.${targetYear}`, false] },
                then: { [targetYear]: `$historicalValue.${targetYear}` },
                else: null,
              },
            },
          },
        },
      ]);
      const redisClient = getRedisClient();
      if (!result) throw new Error('Bag not found');
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
        // Cache the AI response for 24 hours
        await redisClient.set(
          `bag-price-${collection._id}`,
          JSON.stringify(freshAiResponsePayload),
          'PX',
          24 * 60 * 60 * 1000
        );
        aiResponsePayload = freshAiResponsePayload;
      }
      const marketSources: {
        eur: number;
        original: number;
        currency: string;
        source: string;
        url: string;
        title: string;
      }[] = aiResponsePayload?.market_sources?.Search_Results || [];
      const allSites =
        aiResponsePayload?.sources_used?.flatMap(
          (s: { type: string; sites: string[] }) => s.sites
        ) ?? [];
      const priceStatus = {
        trend: aiResponsePayload?.trend ?? null,
        changePercentage: aiResponsePayload?.change_percentage ?? null,
        currentMinValue: aiResponsePayload?.price_range?.min ?? null,
        currentMaxValue: aiResponsePayload?.price_range?.max ?? null,
        currency: aiResponsePayload?.currency ?? null,
        fetchedAt: new Date().toISOString(),
      };
      console.log(marketSources);
      return {
        ...result,
        aiSuggestedPrice:
          Math.round(
            (((priceStatus.currentMinValue ?? 0) +
              (priceStatus.currentMaxValue ?? 0)) /
              2) *
              100
          ) / 100,
        priceStatus,
        source: allSites,
        marketSources: marketSources.map((item) => item.url),
      };
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('An Unexpected Error Occurred In Get One Bag Service');
    }
  }
}
