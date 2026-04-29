import { join, extname } from 'node:path';

import { JwtPayload } from 'jsonwebtoken';
import { Types } from 'mongoose';
import { injectable } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';

import { IUser } from '@/modules/auth/auth.types';
import UserCollection from '@/modules/userBag/userBag.model';
import {
  TCollectionQuery,
  TCreateBagStepFour,
  TCreateBagStepOne,
  TCreateBagStepThree,
  TCreateBagStepTwo,
  TCreateUserCollection,
  TPatchUserCollection,
  TPutUserCollection,
} from '@/modules/userBag/userBag.schemas';
import {
  IUserBag,
  IUserBagResponse,
  IYearValue,
  PublishStatus,
  TCollectionsActions,
  TFileInfo,
  TGetCollectionsResponse,
} from '@/modules/userBag/userBag.types';
import { S3Utils } from '@/utils/s3.utils';
import { SystemUtils } from '@/utils/system.utils';
import Brand from '@/modules/brand/brand.model';
import ModelModel from '@/modules/model/model.model';
import User from '@/modules/auth/auth.model';
import axios from 'axios';
import { env } from '@/env';
import { IBrand } from '@/modules/brand/brand.types';
import { IModel } from '@/modules/model/model.types';
import {
  Currency,
  TAdminBagPriceStatus,
} from '@/modules/adminBag/adminBag.types';
import { monthNameMap } from '@/const';

@injectable()
export class UserBagService {
  constructor(
    private readonly s3Utils: S3Utils,
    private readonly systemUtils: SystemUtils
  ) {}

  async uploadCollectionSingleImage({
    image,
  }: {
    image: Express.Multer.File;
  }): Promise<string> {
    const fileInfo: TFileInfo = {
      filePath: join(__dirname, '../../../public/temp', image.filename),
      mimeType: extname(image.originalname),
      key: `user-collections/bag-image/${uuidv4()}/${Date.now()}${extname(image.originalname)}`,
    };
    try {
      const url = await this.s3Utils.singleUpload(fileInfo);
      return url;
    } catch (error) {
      await this.s3Utils.singleDelete({ key: fileInfo.key });
      if (error instanceof Error) throw error;
      throw new Error(
        'An Unexpected Error Occurred In Upload Collection Single Image Service'
      );
    }
  }

  async uploadCollectionMultipleImages({
    images,
  }: {
    images: Express.Multer.File[];
  }): Promise<string[]> {
    const fileInfos: TFileInfo[] = images.map((file) => ({
      filePath: join(__dirname, '../../../public/temp', file.filename),
      mimeType: extname(file.originalname),
      key: `user-collections/bag-image/${uuidv4()}/${Date.now()}${extname(file.originalname)}`,
    }));
    try {
      const urls = await Promise.all(
        fileInfos.map((fileInfo) => this.s3Utils.singleUpload(fileInfo))
      );
      return urls;
    } catch (error) {
      await Promise.all(
        fileInfos.map(({ key }) => this.s3Utils.singleDelete({ key }))
      );
      if (error instanceof Error) throw error;
      throw new Error(
        'An Unexpected Error Occurred In Upload Collection Multiple Images Service'
      );
    }
  }

  async createCollectionStepOne({
    payload,
    user,
  }: {
    user: IUser;
    payload: TCreateBagStepOne;
  }): Promise<IUserBag> {
    try {
      const response = new UserCollection({
        userId: user._id,
        ...payload,
      });
      await response.save();
      return response;
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error(
        'An Unexpected Error Occurred In Create Collection Step One Service'
      );
    }
  }

  async createCollectionsStepOneUpdate({
    id,
    payload,
  }: {
    payload: TCreateBagStepOne;
    id: string;
  }): Promise<IUserBag> {
    try {
      const response = await UserCollection.findByIdAndUpdate(
        id,
        {
          $set: {
            ...payload,
          },
        },
        { new: true }
      );
      if (!response) throw new Error('Bag Not Found');
      return response;
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error(
        'An Unexpected Error Occurred In Create Collection Step One Update Service'
      );
    }
  }

  async createCollectionsStepTwo({
    id,
    payload,
  }: {
    payload: TCreateBagStepTwo;
    id: string;
  }): Promise<IUserBag> {
    try {
      const response = await UserCollection.findByIdAndUpdate(
        id,
        {
          $set: {
            ...payload,
          },
        },
        { new: true }
      );
      if (!response) throw new Error('Bag Not Found');
      return response;
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error(
        'An Unexpected Error Occurred In Create Collection Step Two Service'
      );
    }
  }

  async createCollectionStepThree({
    id,
    payload,
  }: {
    payload: TCreateBagStepThree;
    id: string;
  }) {
    try {
      const response = await UserCollection.findByIdAndUpdate(
        id,
        {
          $set: {
            ...payload,
          },
        },
        { new: true }
      );
      if (!response) throw new Error('Bag Not Found');
      return response;
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error(
        'An Unexpected Error Occurred In Create Collection Step Three Service'
      );
    }
  }

  async createCollectionStepFour({
    id,
    payload,
    receiptImage,
  }: {
    payload: TCreateBagStepFour;
    id: string;
    receiptImage: Express.Multer.File | null;
  }) {
    try {
      const updateData: Record<string, unknown> = { ...payload };
      if (receiptImage) {
        const filePath = join(
          __dirname,
          '../../../public/temp',
          receiptImage.filename
        );
        const mimeType = extname(receiptImage.originalname);
        const key = `user-collections/receipt-image/${uuidv4()}/${Date.now()}${mimeType}`;
        const url = await this.s3Utils.singleUpload({
          filePath,
          key,
          mimeType,
        });
        updateData.receipt = url;
      }

      const response = await UserCollection.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true }
      );

      if (!response) throw new Error('Bag Not Found');
      return response;
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error(
        'An Unexpected Error Occurred In Create Collection Step Four Service'
      );
    }
  }

  async createCollection({
    bagImages,
    collectionData,
    primaryImage,
    receiptImage,
    user,
  }: {
    user: IUser;
    collectionData: TCreateUserCollection;
    primaryImage: Express.Multer.File;
    receiptImage: Express.Multer.File;
    bagImages: Express.Multer.File[];
  }): Promise<IUserBag> {
    const primaryImageFileInfo: TFileInfo = {
      filePath: join(__dirname, '../../../public/temp', primaryImage.filename),
      mimeType: extname(primaryImage.originalname),
      key: `user-collections/bag-image/${uuidv4()}/${Date.now()}${extname(primaryImage.originalname)}`,
    };
    const receiptImageFile: TFileInfo = {
      filePath: join(__dirname, '../../../public/temp', receiptImage.filename),
      mimeType: extname(receiptImage.originalname),
      key: `user-collections/receipt-image/${uuidv4()}/${Date.now()}${extname(receiptImage.originalname)}`,
    };
    const bagImagesFileInfos: TFileInfo[] = bagImages.map((file) => ({
      filePath: join(__dirname, '../../../public/temp', file.filename),
      mimeType: extname(file.originalname),
      key: `user-collections/bag-image/${uuidv4()}/${Date.now()}${extname(file.originalname)}`,
    }));
    try {
      const [primaryImageUrl, receiptImageUrl] = await Promise.all([
        this.s3Utils.singleUpload(primaryImageFileInfo),
        this.s3Utils.singleUpload(receiptImageFile),
      ]);
      const bagImageUrls = await Promise.all(
        bagImagesFileInfos.map((fileInfo) =>
          this.s3Utils.singleUpload(fileInfo)
        )
      );
      const newCollection = new UserCollection({
        ...collectionData,
        primaryImage: primaryImageUrl,
        receipt: receiptImageUrl,
        images: bagImageUrls,
        userId: user._id,
      });
      await newCollection.save();
      return newCollection;
    } catch (error) {
      await Promise.all([
        this.s3Utils.singleDelete({ key: primaryImageFileInfo.key }),
        this.s3Utils.singleDelete({ key: receiptImageFile.key }),
        ...bagImagesFileInfos.map((fileInfo) =>
          this.s3Utils.singleDelete({ key: fileInfo.key })
        ),
      ]);
      if (error instanceof Error) throw error;
      throw new Error(
        'An Unexpected Error Occurred In Create Collection Service'
      );
    }
  }

  async deleteCollection({
    collection,
    user,
  }: {
    user: IUser;
    collection: IUserBag;
  }): Promise<void> {
    try {
      const primaryImageKey = this.systemUtils.extractS3KeyFromUrl(
        collection.primaryImage
      );
      let receiptImageKey: string | null = null;
      if (collection.receipt) {
        receiptImageKey = this.systemUtils.extractS3KeyFromUrl(
          collection.receipt
        );
      }
      const bagImageKeys = collection.images.map((imageUrl) =>
        this.systemUtils.extractS3KeyFromUrl(imageUrl)
      );
      await Promise.all([
        this.s3Utils.singleDelete({ key: primaryImageKey }),
        ...(receiptImageKey
          ? [this.s3Utils.singleDelete({ key: receiptImageKey })]
          : []),
        ...bagImageKeys.map((key) => this.s3Utils.singleDelete({ key })),
        UserCollection.deleteOne({ _id: collection._id, userId: user._id }),
      ]);
      return;
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error(
        'An Unexpected Error Occurred In Delete Collection Service'
      );
    }
  }

  async patchCollection({
    user,
    collection,
    requestUpdateData,
  }: {
    user: IUser;
    collection: IUserBag;
    requestUpdateData: TPatchUserCollection;
  }): Promise<IUserBag> {
    const aiFields: {
      priceStatus?: TAdminBagPriceStatus;
      historicalValue?: Record<string, IYearValue>;
    } = {};
    const { deletedImages, updatedData } =
      requestUpdateData as TPatchUserCollection;
    let images = [...collection.images];
    const newUpdatedData: Partial<IUserBag> = {
      ...(updatedData as Partial<IUserBag>),
    };
    const isPublished = updatedData?.publishStatus === PublishStatus.PUBLISHED;
    try {
      if (
        deletedImages &&
        deletedImages?.deletedImagesUrls &&
        deletedImages?.deletedImagesUrls.length > 0
      ) {
        images = images.filter(
          (url) => !deletedImages?.deletedImagesUrls.includes(url)
        );
        const deletedImagesKeys = deletedImages?.deletedImagesUrls.map((url) =>
          this.systemUtils.extractS3KeyFromUrl(url)
        );
        await Promise.all(
          deletedImagesKeys.map((key) => this.s3Utils.singleDelete({ key }))
        );
        newUpdatedData.images = images;
      }

      if (isPublished) {
        const plainResponse = await axios.post(
          `${env.AI_SERVER_URL}/bags/price`,
          {
            brand: (collection.brandId as IBrand).brandName,
            model: (collection.modelId as IModel).modelName,
            color: collection.bagColor,
            condition: collection.condition,
            leather: collection.material,
            hardware: collection.hardwareColor,
            size: collection.size,
            special_variant:collection.variant,
          }
        );

        const aiData = plainResponse.data?.data;
        const priceHistory: { period: string; avg_price: number }[] =
          aiData?.price_history?.history ?? [];
        const currency: Currency = aiData?.currency ?? null;

        /* ---------------------------- priceStatus build --------------------------- */

        aiFields.priceStatus = {
          trend: aiData?.trend ?? null,
          changePercentage: aiData?.change_percentage ?? null,
          currentValue: aiData?.current_value ?? null,
          currency,
          fetchedAt: new Date().toISOString(),
        };

        /* -------------------------- historicalValue build ------------------------- */

        const historicalValue: Record<string, IYearValue> = {
          ...(collection.historicalValue ?? {}),
        } as Record<string, IYearValue>;

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
      }

      const data = await UserCollection.findOneAndUpdate(
        {
          _id: collection._id,
          userId: user._id,
        },
        { $set: { ...newUpdatedData, ...aiFields } },
        { new: true }
      );
      if (!data)
        throw new Error('Something went wrong while updating the collection');
      return data;
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error(
        'An Unexpected Error Occurred In Patch Collection Service'
      );
    }
  }
  async editCollection({
    user,
    collection,
    requestUpdateData,
  }: {
    user: IUser;
    collection: IUserBag;
    requestUpdateData: TPatchUserCollection;
  }) {
    try {
      const { updatedData, deletedImages } =
        requestUpdateData as TPatchUserCollection;
      if (
        deletedImages &&
        deletedImages?.deletedImagesUrls &&
        deletedImages?.deletedImagesUrls.length > 0
      ) {
        const deletedImagesKeys = deletedImages?.deletedImagesUrls.map((url) =>
          this.systemUtils.extractS3KeyFromUrl(url)
        );
        await Promise.all(
          deletedImagesKeys.map((key) => this.s3Utils.singleDelete({ key }))
        );
      }
      const data = await UserCollection.findOneAndUpdate(
        {
          _id: collection._id,
          userId: user._id,
        },
        { $set: { ...updatedData } },
        { new: true }
      );
      if (!data)
        throw new Error('Something went wrong while updating the collection');
      return data;
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error(
        'An Unexpected Error Occurred In Edit Collection Service'
      );
    }
  }
  async updateCollection({
    collection,
    user,
    reqData,
    bagImages,
    primaryImage,
    receiptImage,
  }: {
    user: IUser;
    collection: IUserBag;
    reqData: TPutUserCollection;
    primaryImage?: Express.Multer.File;
    receiptImage?: Express.Multer.File;
    bagImages?: Express.Multer.File[];
  }): Promise<IUserBag> {
    const newImages: {
      primaryImageFileInfo?: TFileInfo;
      receiptImageFile?: TFileInfo;
      bagImagesFileInfos?: TFileInfo[];
    } = {};
    const { updatedData, deletedImages } = reqData as TPutUserCollection;
    let images = [...collection.images];
    if (primaryImage) {
      newImages.primaryImageFileInfo = {
        filePath: join(
          __dirname,
          '../../../public/temp',
          primaryImage.filename
        ),
        mimeType: extname(primaryImage.originalname),
        key: `user-collections/bag-image/${uuidv4()}/${Date.now()}${extname(primaryImage.originalname)}`,
      };
    }
    if (receiptImage) {
      newImages.receiptImageFile = {
        filePath: join(
          __dirname,
          '../../../public/temp',
          receiptImage.filename
        ),
        mimeType: extname(receiptImage.originalname),
        key: `user-collections/receipt-image/${uuidv4()}/${Date.now()}${extname(receiptImage.originalname)}`,
      };
    }
    if (bagImages && bagImages?.length > 0) {
      newImages.bagImagesFileInfos = bagImages.map((file) => ({
        filePath: join(__dirname, '../../../public/temp', file.filename),
        mimeType: extname(file.originalname),
        key: `user-collections/bag-image/${uuidv4()}/${Date.now()}${extname(file.originalname)}`,
      }));
    }
    const newUpdatedData: Partial<IUserBag> = {
      ...(updatedData as Partial<IUserBag>),
    };
    try {
      if (
        deletedImages &&
        deletedImages?.deletedImagesUrls &&
        deletedImages?.deletedImagesUrls.length > 0
      ) {
        images = images.filter(
          (url) => !deletedImages?.deletedImagesUrls.includes(url)
        );
        const deletedImagesKeys = deletedImages?.deletedImagesUrls.map((url) =>
          this.systemUtils.extractS3KeyFromUrl(url)
        );
        await Promise.all(
          deletedImagesKeys.map((key) => this.s3Utils.singleDelete({ key }))
        );
        newUpdatedData.images = images;
      }
      if (primaryImage && newImages.primaryImageFileInfo) {
        const url = await this.s3Utils.singleUpload(
          newImages.primaryImageFileInfo
        );
        newUpdatedData.primaryImage = url;
        const oldPrimaryImageKey = this.systemUtils.extractS3KeyFromUrl(
          collection.primaryImage
        );
        await this.s3Utils.singleDelete({ key: oldPrimaryImageKey });
      }
      if (receiptImage && newImages.receiptImageFile) {
        const url = await this.s3Utils.singleUpload(newImages.receiptImageFile);
        newUpdatedData.receipt = url;
        if (collection?.receipt) {
          const oldReceiptImage = this.systemUtils.extractS3KeyFromUrl(
            collection.receipt
          );
          await this.s3Utils.singleDelete({ key: oldReceiptImage });
        }
      }
      if (bagImages && bagImages.length > 0 && newImages.bagImagesFileInfos) {
        const urls = await Promise.all(
          newImages?.bagImagesFileInfos.map((fileInfo) =>
            this.s3Utils.singleUpload(fileInfo)
          )
        );
        images = [...images, ...urls];
        newUpdatedData.images = images;
      }

      // changedData.images=
      const data = await UserCollection.findOneAndUpdate(
        {
          _id: collection._id,
          userId: user._id,
        },
        { $set: { ...newUpdatedData } },
        { new: true }
      );
      if (!data)
        throw new Error('Something went wrong while updating the collection');
      return data;
    } catch (error) {
      if (primaryImage && newImages.primaryImageFileInfo) {
        await this.s3Utils.singleDelete({
          key: newImages.primaryImageFileInfo?.key,
        });
      }
      if (receiptImage && newImages.receiptImageFile) {
        await this.s3Utils.singleDelete({
          key: newImages.receiptImageFile.key,
        });
      }
      if (bagImages && bagImages?.length > 0 && newImages.bagImagesFileInfos) {
        await Promise.all(
          newImages.bagImagesFileInfos.map(({ key }) =>
            this.s3Utils.singleDelete({ key })
          )
        );
      }
      if (error instanceof Error) throw error;
      throw new Error(
        'An Unexpected Error Occurred In Update Collection Service'
      );
    }
  }

  async getAllCollections({
    query,
    user,
  }: {
    user: IUser | JwtPayload;
    query: TCollectionQuery;
  }): Promise<TGetCollectionsResponse> {
    try {
      const {
        brand,
        material,
        limit: queryLimit, // queryLimit is alias of limit
        page: queryPage, // queryPage is alias of page
        // productionYear,
        purchaseYear,
        sortByCreatedAt,
        sortByTrending,
        valueRangeMax,
        valueRangeMin,
        isArchived,
        sortByValue,
      } = query;

      const matchStage: Record<string, any> = {
        userId: user._id,
        isArchived: isArchived ?? false,
        publishStatus: PublishStatus.PUBLISHED,
      };

      if (brand) {
        matchStage.brandId = new Types.ObjectId(brand);
      }

      if (material) {
        matchStage.material = material;
      }

      // if (productionYear) {
      //   matchStage.productionYear = productionYear;
      // }

      if (purchaseYear) {
        matchStage.$expr = {
          $eq: [{ $year: '$purchaseDate' }, purchaseYear],
        };
      }

      // Handle value range - ensure min <= max
      if (valueRangeMin !== undefined || valueRangeMax !== undefined) {
        matchStage['priceStatus.currentValue'] = {};
        if (valueRangeMin !== undefined) {
          matchStage['priceStatus.currentValue'].$gte = valueRangeMin;
        }
        if (valueRangeMax !== undefined) {
          matchStage['priceStatus.currentValue'].$lte = valueRangeMax;
        }
      }

      // Build sort stage
      const sortStage: Record<string, 1 | -1> = {};

      if (sortByCreatedAt) {
        sortStage.createdAt = sortByCreatedAt as 1 | -1;
      }

      if (sortByValue) {
        sortStage['priceStatus.currentValue'] = sortByValue as 1 | -1;
      }

      if (sortByTrending) {
        // Sort by trend field inside priceStatus
        // 'up' should show 'up' trends first, 'down' should show 'down' trends first
        if (sortByTrending === 'up') {
          // For 'up': prioritize 'up' trend over 'down' (descending alphabetically)
          sortStage['priceStatus.trend'] = -1; // 'up' comes before 'down'
          sortStage['priceStatus.changePercentage'] = -1; // Higher percentages first
        } else {
          // For 'down': prioritize 'down' trend over 'up' (ascending alphabetically)
          sortStage['priceStatus.trend'] = 1; // 'down' comes before 'up'
          sortStage['priceStatus.changePercentage'] = 1; // Lower (more negative) first
        }
      }

      // Default sort by createdAt descending if no sort specified
      if (Object.keys(sortStage).length === 0) {
        sortStage.createdAt = -1;
      }

      const page = queryPage ?? 1;
      const limit = queryLimit ?? 10;
      const skip = (page - 1) * limit;

      const [result] = await UserCollection.aggregate([
        { $match: matchStage },
        {
          $facet: {
            collections: [
              { $sort: sortStage },
              { $skip: skip },
              { $limit: limit },
              {
                $lookup: {
                  from: 'brands',
                  localField: 'brandId',
                  foreignField: '_id',
                  as: 'brand',
                },
              },
              {
                $unwind: {
                  path: '$brand',
                  preserveNullAndEmptyArrays: true,
                },
              },
              {
                $lookup: {
                  from: 'models',
                  localField: 'modelId',
                  foreignField: '_id',
                  as: 'model',
                },
              },
              {
                $unwind: {
                  path: '$model',
                  preserveNullAndEmptyArrays: true,
                },
              },
              {
                $project: {
                  _id: 1,
                  primaryImage: 1,
                  images: 1,
                  priceStatus: 1,
                  isArchived: 1,
                  createdAt: 1,
                  updatedAt: 1,
                  brand: 1,
                  model: 1,
                  __v: 1,
                },
              },
            ],
            metadata: [
              {
                $group: {
                  _id: null,
                  totalBags: { $sum: 1 },
                  totalValue: { $sum: '$priceStatus.currentValue' },
                  totalCost: { $sum: 'purchasePrice' },
                },
              },
            ],
          },
        },
      ]);

      const data = result.collections || [];
      const metaData = result.metadata[0] || {
        _id: null,
        totalBags: 0,
        totalValue: 0,
        averageValue: 0,
      };

      const totalPages = Math.ceil(metaData.totalBags / limit) || 0;
      const from = metaData.totalBags === 0 ? 0 : skip + 1;
      const to = Math.min(skip + limit, metaData.totalBags);
      const showing = `Showing ${from} to ${to} of ${metaData.totalBags} results`;

      const isAdmin = user.role === 'admin';
      const basePath = isAdmin ? '/admin/collections' : '/collections';
      const actions: TCollectionsActions = {
        create: isAdmin
          ? undefined
          : {
              href: `${basePath}`,
              method: 'POST',
            },
        update_with_image:
          isAdmin && data.length > 0
            ? undefined
            : {
                href: `${basePath}/:id`,
                method: 'PUT',
              },
        update_only_text:
          isAdmin && data.length > 0
            ? undefined
            : {
                href: `${basePath}/:id`,
                method: 'PATCH',
              },
        delete: {
          href: `${basePath}/:id`,
          method: 'DELETE',
        },
      };

      if (data.length === 0) {
        return {
          data,
          meta: {
            total: metaData.totalBags,
            totalValue: metaData.totalValue,
            totalCost: metaData.totalCost,
            page,
            limit,
            totalPages,
            links: null,
            actions,
            showing,
          },
        };
      }

      const buildLink = (pageNum: number): string => {
        const params = new URLSearchParams();
        params.set('page', pageNum.toString());
        params.set('limit', limit.toString());

        if (brand) params.set('brand', brand);
        if (material) params.set('material', material);
        // if (productionYear)
        //   params.set('productionYear', productionYear.toString());
        if (purchaseYear) params.set('purchaseYear', purchaseYear.toString());
        if (valueRangeMin !== undefined)
          params.set('valueRangeMin', valueRangeMin.toString());
        if (valueRangeMax !== undefined)
          params.set('valueRangeMax', valueRangeMax.toString());
        if (sortByCreatedAt)
          params.set('sortByCreatedAt', sortByCreatedAt.toString());
        if (sortByTrending) params.set('sortByTrending', sortByTrending);
        if (isArchived !== undefined)
          params.set('isArchived', isArchived.toString());
        if (sortByValue) params.set('sortByValue', sortByValue.toString());

        return `${basePath}?${params.toString()}`;
      };

      return {
        data,
        meta: {
          total: metaData.totalBags,
          totalValue: metaData.totalValue,
          totalCost: metaData.totalCost,
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
      throw new Error(
        'An Unexpected Error Occurred In Get All Collections Service'
      );
    }
  }

  async deleteOneCollectionByAdmin({
    collection,
  }: {
    collection: IUserBag;
  }): Promise<void> {
    try {
      const primaryImageKey = this.systemUtils.extractS3KeyFromUrl(
        collection.primaryImage
      );
      let receiptImageKey: string | null = null;
      if (collection.receipt) {
        receiptImageKey = this.systemUtils.extractS3KeyFromUrl(
          collection.receipt
        );
      }
      const bagImageKeys = collection.images.map((imageUrl) =>
        this.systemUtils.extractS3KeyFromUrl(imageUrl)
      );
      await Promise.all([
        this.s3Utils.singleDelete({ key: primaryImageKey }),
        ...(receiptImageKey
          ? [this.s3Utils.singleDelete({ key: receiptImageKey })]
          : []),
        ...bagImageKeys.map((key) => this.s3Utils.singleDelete({ key })),
        UserCollection.deleteOne({ _id: collection._id }),
      ]);
      return;
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error(
        'An Unexpected Error Occurred In Admin Delete One Collections Service'
      );
    }
  }

  async getAllCollectionsForAdmin({
    user,
    query,
  }: {
    user: JwtPayload;
    query: TCollectionQuery;
  }): Promise<TGetCollectionsResponse> {
    try {
      const { limit: queryLimit, page: queryPage } = query;
      const page = queryPage ?? 1;
      const limit = queryLimit ?? 10;
      const skip = (page - 1) * limit;
      const [result] = await UserCollection.aggregate([
        {
          $facet: {
            collections: [
              { $skip: skip },
              { $limit: limit },
              {
                $lookup: {
                  from: 'brands',
                  localField: 'brandId',
                  foreignField: '_id',
                  as: 'brand',
                },
              },
              {
                $unwind: {
                  path: '$brand',
                  preserveNullAndEmptyArrays: true,
                },
              },
              {
                $lookup: {
                  from: 'models',
                  localField: 'modelId',
                  foreignField: '_id',
                  as: 'model',
                },
              },
              {
                $unwind: {
                  path: '$model',
                  preserveNullAndEmptyArrays: true,
                },
              },
              {
                $lookup: {
                  from: 'users',
                  localField: 'userId',
                  foreignField: '_id',
                  as: 'user',
                },
              },
              {
                $unwind: {
                  path: '$user',
                  preserveNullAndEmptyArrays: true,
                },
              },
              {
                $project: {
                  _id: 1,
                  primaryImage: 1,
                  images: 1,
                  priceStatus: 1,
                  isArchived: 1,
                  createdAt: 1,
                  updatedAt: 1,
                  brand: 1,
                  model: 1,
                  purchasePrice: 1,
                  purchaseDate: 1,
                  'user._id': 1,
                  'user.name': 1,
                  'user.avatar': 1,
                  __v: 1,
                },
              },
            ],
            metadata: [
              {
                $group: {
                  _id: null,
                  totalBags: { $sum: 1 },
                },
              },
            ],
          },
        },
      ]);
      const data = result.collections || [];
      const metaData = result.metadata[0] || {
        _id: null,
        totalBags: 0,
      };
      const totalPages = Math.ceil(metaData.totalBags / limit) || 0;
      const from = metaData.totalBags === 0 ? 0 : skip + 1;
      const to = Math.min(skip + limit, metaData.totalBags);
      const showing = `Showing ${from} to ${to} of ${metaData.totalBags} results`;
      const isAdmin = user.role === 'admin';
      const basePath = isAdmin ? '/admin/collections' : '/collections';
      const actions: TCollectionsActions = {
        create: isAdmin
          ? undefined
          : {
              href: `${basePath}`,
              method: 'POST',
            },
        update_with_image:
          isAdmin && data.length > 0
            ? undefined
            : {
                href: `${basePath}/:id`,
                method: 'PUT',
              },
        update_only_text:
          isAdmin && data.length > 0
            ? undefined
            : {
                href: `${basePath}/:id`,
                method: 'PATCH',
              },
        delete: {
          href: `${basePath}/:id`,
          method: 'DELETE',
        },
      };
      if (data.length === 0) {
        return {
          data,
          meta: {
            total: metaData.totalBags,
            page,
            limit,
            totalPages,
            links: null,
            actions,
            showing,
          },
        };
      }
      const buildLink = (pageNum: number): string => {
        const params = new URLSearchParams();
        params.set('page', pageNum.toString());
        params.set('limit', limit.toString());
        return `${basePath}?${params.toString()}`;
      };
      return {
        data,
        meta: {
          total: metaData.totalBags,
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
      throw new Error(
        'An Unexpected Error Occurred In Admin Get All Collections Service'
      );
    }
  }

  async checkBrandModel({
    brandName,
    modelName,
  }: {
    brandName: string;
    modelName: string;
  }) {
    try {
      const admin = await User.findOne({ role: 'admin' });
      const userId = admin?._id;
      // 1. Search for existing brand (case-insensitive)
      let brand = await Brand.findOne({
        brandName: { $regex: new RegExp(`^${brandName}$`, 'i') },
      });

      // 2. Search for existing model (case-insensitive)
      let existingModel = await ModelModel.findOne({
        modelName: { $regex: new RegExp(`^${modelName}$`, 'i') },
      });

      // Case A — Both brand and model already exist → return as-is
      if (brand && existingModel) {
        return {
          brand,
          model: existingModel,
          created: { brand: false, model: false },
        };
      }

      // Case B — Brand exists, model does NOT → create only the model
      if (brand && !existingModel) {
        const newModel = await ModelModel.create({
          modelName,
          brandId: brand._id,
          createdBy: userId,
        });

        return {
          brand,
          model: newModel,
          created: { brand: false, model: true },
        };
      }

      // Case C — Neither brand nor model exists → create both
      if (!brand) {
        brand = await Brand.create({
          brandName,
          createdBy: userId,
        });

        const newModel = await ModelModel.create({
          modelName,
          brandId: brand._id,
          createdBy: userId,
        });

        return {
          brand,
          model: newModel,
          created: { brand: true, model: true },
        };
      }
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error(
        'An Unexpected Error Occurred In Check Brand Model Service'
      );
    }
  }

  async getCollectionById({
    collection,
    year,
  }: {
    collection: IUserBag;
    year?: string;
  }): Promise<IUserBagResponse> {
    try {
      const targetYear = year ?? new Date().getFullYear().toString();

      const [result] = await UserCollection.aggregate([
        {
          $match: { _id: collection._id },
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
      if (!result) throw new Error('Bag not found');
      const plainResponse = await axios.post(
        `${env.AI_SERVER_URL}/bags/price`,
        {
          brand: (collection.brandId as IBrand).brandName,
          model: (collection.modelId as IModel).modelName,
          color: collection.bagColor,
          condition: collection.condition,
          leather: collection.material,
          hardware: collection.hardwareColor,
          size: collection.size,
        }
      );
      const aiResponsePayload = plainResponse.data?.data;

      return {
        ...result,
        aiSuggestedPrice: aiResponsePayload?.current_value,
      };
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('An Unexpected Error Occurred In Get One Bag Service');
    }
  }

  async changeCollectionCurrentPrice({
    currentPrice,
    collection,
  }: {
    currentPrice: number;
    collection: IUserBag;
  }): Promise<IUserBag> {
    try {
      const result = await UserCollection.findOneAndUpdate(
        { _id: collection._id },
        {
          $set: {
            'priceStatus.currentValue': currentPrice,
          },
        },
        { new: true }
      );
      if (!result)
        throw new Error('Bag not found while updating current price');
      return result;
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error(
        'An Unexpected Error Occurred In Change Collection Current Price Service'
      );
    }
  }
}
