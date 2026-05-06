import { JwtPayload } from 'jsonwebtoken';
import { Types } from 'mongoose';
import { injectable } from 'tsyringe';

import { CreateWishDTO } from '@/modules/wishlist/wishlist.dto';
import Wishlist from '@/modules/wishlist/wishlist.model';
import {
  IPriceDescription,
  IWishlist,
  TGetWishlistResponse,
  TWishlistActions,
} from '@/modules/wishlist/wishlist.types';
import { S3Utils } from '@/utils/s3.utils';
import { SystemUtils } from '@/utils/system.utils';
import {
  TCreateWishPayload,
  TUpdateWishPayload,
} from '@/modules/wishlist/wishlist.schemas';
import { IUser } from '@/modules/auth/auth.types';
import { Schema } from 'mongoose';

@injectable()
export class WishlistService {
  constructor(
    private readonly s3Utils: S3Utils,
    private readonly systemUtils: SystemUtils
  ) {}

  async createWish({
    user,
    payload,
  }: {
    user: IUser;
    payload: TCreateWishPayload;
  }): Promise<unknown> {
    const {
      brandId,
      color,
      condition,
      currency,
      hardwareColor,
      material,
      modelId,
      priority,
      size,
      specialVariant,
      targetPrice,
      variant,
      note,
      image,
    } = payload;
    try {
      const newWish = new Wishlist({
        userId: user._id,
        brandId: new Types.ObjectId(brandId),
        modelId: new Types.ObjectId(modelId),
        priority,
        color,
        material,
        note,
        size,
        specialVariant,
        targetPrice,
        variant,
        image,
        condition,
        currency,
        hardwareColor,
      });
      await newWish.save();
      await newWish.populate([
        { path: 'brandId', select: '_id brandName brandLogo' },
        { path: 'modelId', select: '_id modelName modelImage brandId' },
      ]);
      return newWish;
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('An unexpected error occurred on create wish service');
    }
  }

  async deleteWish({ wish }: { wish: IWishlist }): Promise<void> {
    try {
      const key = this.systemUtils.extractS3KeyFromUrl(wish.image);
      await this.s3Utils.singleDelete({ key });
      await Wishlist.deleteOne({ _id: wish._id });
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('An unexpected error occurred on delete wish service');
    }
  }

  async getWishes({
    user,
    page,
    limit,
    priority,
  }: {
    user: IUser;
    page?: string;
    limit?: string;
    priority?: string;
  }): Promise<TGetWishlistResponse> {
    try {
      const queryPage = parseInt(page || '1', 10);
      const queryLimit = parseInt(limit || '10', 10);
      const skip = (queryPage - 1) * queryLimit;
      const userId = user?._id;
      const matchStage: { userId: Schema.Types.ObjectId; priority?: string } = {
        userId,
      };
      if (priority) matchStage.priority = priority;
      console.log(matchStage);
      const [result] = await Wishlist.aggregate([
        { $match: matchStage },
        {
          $facet: {
            wishes: [
              { $skip: skip },
              { $limit: queryLimit },
              {
                $lookup: {
                  from: 'brands',
                  localField: 'brandId',
                  foreignField: '_id',
                  as: 'brandData',
                },
              },
              { $unwind: '$brandData' },
              {
                $lookup: {
                  from: 'models',
                  localField: 'modelId',
                  foreignField: '_id',
                  as: 'modelData',
                },
              },
              { $unwind: '$modelData' },
              {
                $project: {
                  // Summary fields per item
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
                  color: 1,
                  priority: 1,
                  status: 1,
                  targetPrice: 1,
                  currency: 1,
                  image: 1,
                  createdAt: 1,
                  updatedAt: 1,
                },
              },
            ],

            // Total count of matched documents
            totalCount: [{ $count: 'count' }],

            // Sum of targetPrice across ALL matched documents (not just current page)
            totalTargetPrice: [
              {
                $group: {
                  _id: null,
                  total: { $sum: '$targetPrice' }, // ✅ fixed field path
                },
              },
            ],
          },
        },
      ]);
      console.log(result);
      // Extract the results
      const wishes = result?.wishes || [];
      const totalCount = result?.totalCount[0]?.count || 0;
      const totalTargetPrice = result?.totalTargetPrice[0]?.total || 0;
      const totalPages = Math.ceil(totalCount / queryLimit);
      // Calculate showing range
      const from = totalCount === 0 ? 0 : skip + 1;
      const to = Math.min(skip + queryLimit, totalCount);
      const showing = `Showing ${from} to ${to} of ${totalCount} results`;
      const basePath = '/wishlists';
      const actions: TWishlistActions = {
        create: {
          href: `${basePath}`,
          method: 'POST',
        },
        update:
          wishes.length > 0
            ? {
                href: `${basePath}/:id`,
                method: 'PATCH',
              }
            : undefined,
        delete:
          wishes.length > 0
            ? {
                href: `${basePath}/:id`,
                method: 'DELETE',
              }
            : undefined,
      };
      // If no data, return null for links
      if (wishes.length === 0) {
        return {
          data: wishes,
          totalTargetPrice,
          meta: {
            total: totalCount,
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
        if (priority) query.set('priority', priority);
        return `${basePath}?${query.toString()}`;
      };

      return {
        data: wishes,
        totalTargetPrice,
        meta: {
          total: totalCount,
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
      throw new Error('An unexpected error occurred on get wishes service');
    }
  }

  async changeWishStatus({
    wish,
    payload,
  }: {
    wish: IWishlist;
    payload: TUpdateWishPayload;
  }): Promise<unknown> {
    try {
      const { currency, image, note, priority, status, targetPrice } = payload;
      const updatedWish = await Wishlist.findOneAndUpdate(
        { _id: wish._id },
        { image, note, priority, status, targetPrice, currency },
        { new: true }
      );
      const key = this.systemUtils.extractS3KeyFromUrl(wish.image);
      await this.s3Utils.singleDelete({ key });
      if (!updatedWish) {
        throw new Error('Something went wrong while updating wish status');
      }
      return updatedWish;
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error(
        'An unexpected error occurred on change wish status service'
      );
    }
  }
}
