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
  }): Promise<CreateAdminBagDTO> {
    const {
      bagBrand,
      bagColor,
      bagModel,
      material,
      hardwareColor,
      size,
      condition,
    } = payload;
    const filePath = join(__dirname, '../../../public/temp', file);
    const mimeType = extname(filePath);
    const key = `admin-bags/${uuidv4()}/${Date.now()}${mimeType}`;
    try {
      const plainResponse = await axios.post(
        `${env.AI_SERVER_URL}/bags/price`,
        {
          brand: bagBrand,
          model: bagModel,
          color: bagColor,
          condition: condition,
          leather: material,
          hardware: hardwareColor,
          size: size,
        }
      );
      const aiData = plainResponse.data?.data;
      const currency: Currency = aiData?.currency ?? null;
      const priceStatus = {
        trend: aiData?.trend ?? null,
        changePercentage: aiData?.change_percentage ?? null,
        currentValue: aiData?.current_value ?? null,
        currency,
        fetchedAt: new Date().toISOString(),
      };
      const url = await this.s3Utils.singleUpload({
        filePath,
        key,
        mimeType,
      });
      const newAdminBag = new AdminBag({
        bagBrand,
        bagModel,
        bagColor,
        material,
        hardwareColor,
        size,
        condition,
        image: url,
        // productionYear: priceData.productionYear,
        priceStatus,
        user: new Types.ObjectId(user._id as string),
      });
      await newAdminBag.save();
      return CreateAdminBagDTO.fromEntity(newAdminBag);
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
      const [result] = await AdminBag.aggregate([
        {
          $facet: {
            data: [
              { $skip: skip },
              { $limit: queryLimit },
              {
                $lookup: {
                  from: 'brands',
                  localField: 'bagBrand', // ⚠️ Changed from 'brandId' to 'bagBrand'
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
              {
                $lookup: {
                  from: 'models',
                  localField: 'bagModel', // ⚠️ Changed from 'modelId' to 'bagModel'
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
              {
                $addFields: {
                  bagBrand: {
                    // ⚠️ Changed from 'brandId' to 'bagBrand'
                    _id: '$brandData._id',
                    brandName: '$brandData.brandName',
                    brandLogo: '$brandData.brandLogo',
                  },
                  bagModel: {
                    // ⚠️ Changed from 'modelId' to 'bagModel'
                    _id: '$modelData._id',
                    modelName: '$modelData.modelName',
                    modelImage: '$modelData.modelImage',
                    brandId: '$modelData.brandId',
                  },
                },
              },
              {
                $project: {
                  brandData: 0,
                  modelData: 0,
                },
              },
            ],
            totalCount: [{ $count: 'count' }],
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

  async deleteAdminBag({ bag }: { bag: IAdminBags }): Promise<void> {
    try {
      const key = this.systemUtils.extractS3KeyFromUrl(bag.image);
      await this.s3Utils.singleDelete({ key });
      await AdminBag.findByIdAndDelete(bag._id);
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('Unknown Error Occurred In Admin Bag Deletion Service');
    }
  }

  async updateAdminBag({
    bag,
    file,
    payload,
  }: {
    bag: IAdminBags;
    payload: TUpdateAdminBagPayload;
    file?: string;
  }): Promise<CreateAdminBagDTO> {
    const { bagColor, material, hardwareColor, size, condition } = payload;
    let bagImage = bag.image;
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

      const data = await AdminBag.findByIdAndUpdate(
        bag._id,
        {
          image: bagImage,
          bagColor,
          material,
          hardwareColor,
          size,
          condition,
        },
        { new: true }
      );
      if (!data) throw new Error('Admin Bag Not Found For Update');
      return CreateAdminBagDTO.fromEntity(data);
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('Unknown Error Occurred In Update Bag Service');
    }
  }
}
