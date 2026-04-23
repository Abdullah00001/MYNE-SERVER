import { extname, join } from 'path';

import { JwtPayload } from 'jsonwebtoken';
import { Types } from 'mongoose';
import { injectable } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';

import { IUser } from '@/modules/auth/auth.types';
import { GetModelDTO } from '@/modules/model/model.dto';
import ModelModel from '@/modules/model/model.model';
import {
  IModel,
  TBrandActions,
  TGetModelResponse,
} from '@/modules/model/model.types';
import { Role } from '@/types/jwt.types';
import { S3Utils } from '@/utils/s3.utils';
import { SystemUtils } from '@/utils/system.utils';

@injectable()
export class ModelService {
  constructor(
    private readonly s3Utils: S3Utils,
    private readonly systemUtils: SystemUtils
  ) {}

  async createModel({
    brandId,
    fileName,
    mimeType,
    modelName,
    user,
  }: {
    modelName: string;
    brandId: string;
    fileName: string;
    mimeType: string;
    user: JwtPayload;
  }): Promise<GetModelDTO> {
    const filePath = join(__dirname, '../../../public/temp', fileName);
    const fileExtension = extname(filePath);
    const s3Key = `model/${uuidv4()}/${Date.now()}${fileExtension}`;
    try {
      const url = await this.s3Utils.singleUpload({
        filePath,
        key: s3Key,
        mimeType,
      });
      const newModel = new ModelModel({
        modelName,
        brandId: new Types.ObjectId(brandId),
        createdBy: new Types.ObjectId(user._id as string),
        modelImage: url,
      });
      await newModel.save();
      return GetModelDTO.fromEntity(newModel);
    } catch (error) {
      await this.s3Utils.singleDelete({ key: s3Key });
      if (error instanceof Error) throw error;
      throw new Error('Unknown error occurred in create model service');
    }
  }

  async updateModelWithImage({
    fileName,
    mimeType,
    modelName,
    model,
  }: {
    modelName?: string;
    fileName?: string;
    mimeType?: string;
    model: IModel;
  }): Promise<GetModelDTO> {
    try {
      let modelImage = model.modelImage;

      if (fileName && mimeType) {
        const filePath = join(__dirname, '../../../public/temp', fileName);
        const fileExtension = extname(filePath);
        const s3Key = `model/${uuidv4()}/${Date.now()}${fileExtension}`;

        if (model.modelImage) {
          const key = this.systemUtils.extractS3KeyFromUrl(model.modelImage);
          await this.s3Utils.singleDelete({ key });
        }

        try {
          modelImage = await this.s3Utils.singleUpload({
            filePath,
            key: s3Key,
            mimeType,
          });
        } catch (uploadError) {
          await this.s3Utils.singleDelete({ key: s3Key });
          throw uploadError;
        }
      }

      const data = await ModelModel.findByIdAndUpdate(
        model._id,
        { $set: { modelName, modelImage } },
        { new: true }
      );

      if (!data) {
        throw new Error('Something went wrong update model service');
      }

      return GetModelDTO.fromEntity(data);
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('Unknown error occurred in update model service');
    }
  }

  async updateModelWithoutImage({
    modelName,
    model,
  }: {
    modelName: string;
    model: IModel;
  }): Promise<GetModelDTO> {
    try {
      const data = await ModelModel.findByIdAndUpdate(
        model._id,
        { $set: { modelName } },
        { new: true }
      );
      if (!data) {
        throw new Error('Something went wrong update model service');
      }
      return GetModelDTO.fromEntity(data);
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('Unknown error occurred in update model service');
    }
  }

  async deleteModel({ model }: { model: IModel }): Promise<void> {
    try {
      const key = this.systemUtils.extractS3KeyFromUrl(model.modelImage);
      await Promise.all([
        this.s3Utils.singleDelete({ key }),
        ModelModel.deleteOne(model._id),
      ]);
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('Unknown error occurred in delete model service');
    }
  }

  async getModels({
    params,
    user,
  }: {
    params: {
      page?: string;
      limit?: string;
      search?: string;
      brandId?: string;
    };
    user: IUser | JwtPayload;
  }): Promise<TGetModelResponse> {
    try {
      const page = parseInt(params.page || '1', 10);
      const limit = parseInt(params.limit || '10', 10);
      const skip = (page - 1) * limit;
      const search = params?.search?.trim();
      const brandId = params?.brandId?.trim();
      const isAdmin = user.role === Role.ADMIN;

      // Build match conditions
      const matchConditions: Record<string, unknown> = {};

      if (search) {
        matchConditions.modelName = { $regex: search, $options: 'i' };
      }

      if (brandId) {
        if (!Types.ObjectId.isValid(brandId)) {
          throw new Error('Invalid brandId format');
        }
        matchConditions.brandId = new Types.ObjectId(brandId);
      }

      const matchStage =
        Object.keys(matchConditions).length > 0
          ? [{ $match: matchConditions }]
          : [];

      const [result] = await ModelModel.aggregate([
        ...matchStage,
        {
          $lookup: {
            from: 'brands', // MongoDB collection name
            localField: 'brandId',
            foreignField: '_id',
            as: 'brand',
            pipeline: [
              {
                $project: {
                  _id: 1,
                  brandName: 1,
                  brandImage: 1,
                },
              },
            ],
          },
        },
        {
          // Unwind to object — preserve models with no brand as null
          $addFields: {
            brand: { $arrayElemAt: ['$brand', 0] },
          },
        },
        {
          $facet: {
            data: [{ $skip: skip }, { $limit: limit }],
            total: [{ $count: 'count' }],
          },
        },
      ]);

      const rawData = result.data || [];
      const total = result.total[0]?.count || 0;
      const totalPages = Math.ceil(total / limit);
      const data = rawData;

      const from = total === 0 ? 0 : skip + 1;
      const to = Math.min(skip + limit, total);
      const showing = `Showing ${from} to ${to} of ${total} results`;

      const basePath = user.role === 'admin' ? '/admin/model' : '/model';

      const actions: TBrandActions = {
        create: isAdmin ? { href: `${basePath}`, method: 'POST' } : undefined,
        update:
          isAdmin && data.length > 0
            ? { href: `${basePath}/:id`, method: 'PUT' }
            : undefined,
        delete:
          isAdmin && data.length > 0
            ? { href: `${basePath}/:id`, method: 'DELETE' }
            : undefined,
      };

      if (data.length === 0) {
        return {
          data,
          meta: {
            total,
            page,
            limit,
            totalPages,
            links: null,
            actions,
            showing,
          },
        };
      }

      // Preserve all active filters in pagination links
      const buildLink = (pageNum: number): string => {
        const query = new URLSearchParams();
        query.set('page', pageNum.toString());
        query.set('limit', limit.toString());
        if (search) query.set('search', search);
        if (brandId) query.set('brandId', brandId);
        return `${basePath}?${query.toString()}`;
      };

      return {
        data,
        meta: {
          total,
          page,
          limit,
          totalPages,
          links: {
            first: buildLink(1),
            last: buildLink(totalPages),
            previous: page > 1 ? buildLink(page - 1) : null,
            next: page < totalPages ? buildLink(page + 1) : null,
            current: buildLink(page),
          },
          actions,
          showing,
        },
      };
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('Unknown error occurred in get models service');
    }
  }

  async createBrandByUser({
    brandId,
    modelName,
    user,
  }: {
    user: IUser;
    modelName: string;
    brandId: string;
  }): Promise<IModel> {
    try {
      const newModel = new ModelModel({
        modelName,
        brandId: new Types.ObjectId(brandId),
        createdBy: user?._id,
      });
      await newModel.save();
      return newModel;
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('Unknown error occurred in create model by user service');
    }
  }

  async searchModel({
    modelName,
  }: {
    modelName: string;
  }): Promise<GetModelDTO[]> {
    try {
      const escapedQuery = modelName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Search with multiple strategies
      const data = await ModelModel.find({
        $or: [
          // Exact match (highest priority)
          { modelName: { $regex: `^${escapedQuery}$`, $options: 'i' } },
          // Starts with
          { modelName: { $regex: `^${escapedQuery}`, $options: 'i' } },
          // Contains
          { modelName: { $regex: escapedQuery, $options: 'i' } },
        ],
      }).limit(50);
      if (!data) throw new Error('Something went wrong on model search');
      return data.map((item: IModel) => GetModelDTO.fromEntity(item));
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('Unknown error occurred in search model service');
    }
  }
}
