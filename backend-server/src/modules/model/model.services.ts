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
    params: { page: string | null; limit: string | null };
    user: IUser | JwtPayload;
  }): Promise<TGetModelResponse> {
    try {
      const page = parseInt(params.page || '1', 10);
      const limit = parseInt(params.limit || '10', 10);
      const skip = (page - 1) * limit;
      const isAdmin = user.role === Role.ADMIN;
      const [result] = await ModelModel.aggregate([
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

      // Calculate showing range
      const from = total === 0 ? 0 : skip + 1;
      const to = Math.min(skip + limit, total);
      const showing = `Showing ${from} to ${to} of ${total} results`;

      // Determine base path based on user role
      const basePath = user.role === 'admin' ? '/admin/model' : '/model';

      const actions: TBrandActions = {
        create: isAdmin
          ? {
              href: `${basePath}`,
              method: 'POST',
            }
          : undefined,
        update:
          isAdmin && data.length > 0
            ? {
                href: `${basePath}/:id`,
                method: 'PUT',
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
            page,
            limit,
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
        query.set('limit', limit.toString());
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
      throw new Error('Unknown error occurred in delete model service');
    }
  }

  // TODO: implement here search service

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
