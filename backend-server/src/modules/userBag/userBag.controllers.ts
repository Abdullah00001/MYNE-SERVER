import { Request, Response, RequestHandler } from 'express';
import { injectable } from 'tsyringe';

import { BaseController } from '@/core/base_classes/base.controller';
import { IUser } from '@/modules/auth/auth.types';
import {
  TCollectionQuery,
  TCreateBagStepFour,
  TCreateBagStepOne,
  TCreateBagStepThree,
  TCreateBagStepTwo,
  TCreateUserCollection,
  TPatchUserCollection,
} from '@/modules/userBag/userBag.schemas';
import { UserBagService } from '@/modules/userBag/userBag.services';
import { TAdminBagPriceStatus } from '@/modules/adminBag/adminBag.model';

@injectable()
export class UserBagController extends BaseController {
  public createCollection: RequestHandler;
  public deleteCollection: RequestHandler;
  public getCollectionById: RequestHandler;
  public patchCollection: RequestHandler;
  public updateCollection: RequestHandler;
  public getUserCollection: RequestHandler;
  public deleteOneCollectionByAdmin: RequestHandler;
  public getAllCollectionForAdmin: RequestHandler;
  public createCollectionStepOne: RequestHandler;
  public createCollectionStepTwo: RequestHandler;
  public createCollectionStepThree: RequestHandler;
  public createCollectionStepFour: RequestHandler;
  public createCollectionStepOneUpdate: RequestHandler;
  public uploadCollectionSingleImage: RequestHandler;
  public uploadCollectionMultipleImages: RequestHandler;
  public checkBrandModel: RequestHandler;
  public changeCollectionCurrentPrice: RequestHandler;

  constructor(private readonly userBagService: UserBagService) {
    super();
    this.createCollection = this.wrap(this._createCollection);
    this.deleteCollection = this.wrap(this._deleteCollection);
    this.getCollectionById = this.wrap(this._getCollectionById);
    this.patchCollection = this.wrap(this._patchCollection);
    this.updateCollection = this.wrap(this._updateCollection);
    this.getUserCollection = this.wrap(this._getUserCollection);
    this.deleteOneCollectionByAdmin = this.wrap(
      this._deleteOneCollectionByAdmin
    );
    this.getAllCollectionForAdmin = this.wrap(this._getAllCollectionForAdmin);
    this.createCollectionStepOne = this.wrap(this._createCollectionStepOne);
    this.createCollectionStepTwo = this.wrap(this._createCollectionStepTwo);
    this.createCollectionStepThree = this.wrap(this._createCollectionStepThree);
    this.createCollectionStepFour = this.wrap(this._createCollectionStepFour);
    this.createCollectionStepOneUpdate = this.wrap(
      this._createCollectionStepOneUpdate
    );
    this.uploadCollectionSingleImage = this.wrap(
      this._uploadCollectionSingleImage
    );
    this.uploadCollectionMultipleImages = this.wrap(
      this._uploadCollectionMultipleImages
    );
    this.checkBrandModel = this.wrap(this._checkBrandModel);
    this.changeCollectionCurrentPrice = this.wrap(
      this._changeCollectionCurrentPrice
    );
  }

  private async _uploadCollectionSingleImage(
    req: Request,
    res: Response
  ): Promise<void> {
    const image = req.file as Express.Multer.File;
    const url = await this.userBagService.uploadCollectionSingleImage({
      image,
    });
    res.status(200).json({
      success: true,
      status: 200,
      message: 'Image uploaded successfully',
      data: { url },
    });
    return;
  }

  private async _uploadCollectionMultipleImages(
    req: Request,
    res: Response
  ): Promise<void> {
    const images = req.files as Express.Multer.File[];
    const urls = await this.userBagService.uploadCollectionMultipleImages({
      images,
    });
    res.status(200).json({
      success: true,
      status: 200,
      message: 'Images uploaded successfully',
      data: { urls },
    });
    return;
  }

  private async _createCollectionStepOne(
    req: Request,
    res: Response
  ): Promise<void> {
    const user = req.user as IUser;
    const requestPayload = req.body as TCreateBagStepOne;
    const data = await this.userBagService.createCollectionStepOne({
      payload: requestPayload,
      user,
    });
    res.status(201).json({
      success: true,
      status: 201,
      message: 'Create collection step one initialized',
      data,
    });
    return;
  }

  private async _createCollectionStepOneUpdate(
    req: Request,
    res: Response
  ): Promise<void> {
    const requestPayload = req.body as TCreateBagStepOne;
    const { id } = req.params;
    const data = await this.userBagService.createCollectionsStepOneUpdate({
      id: id as string,
      payload: requestPayload,
    });
    res.status(201).json({
      success: true,
      status: 201,
      message: 'Create collection step one update successful',
      data,
    });
    return;
  }

  private async _createCollectionStepTwo(
    req: Request,
    res: Response
  ): Promise<void> {
    const requestPayload = req.body as TCreateBagStepTwo;
    const { id } = req.params;
    const data = await this.userBagService.createCollectionsStepTwo({
      id: id as string,
      payload: requestPayload,
    });
    res.status(200).json({
      success: true,
      status: 200,
      message: 'Create collection step two complete successful',
      data,
    });
    return;
  }

  private async _createCollectionStepThree(
    req: Request,
    res: Response
  ): Promise<void> {
    const requestPayload = req.body as TCreateBagStepThree;
    const { id } = req.params;
    const data = await this.userBagService.createCollectionStepThree({
      id: id as string,
      payload: requestPayload,
    });
    res.status(200).json({
      success: true,
      status: 200,
      message: 'Create collection step three complete successful',
      data,
    });
    return;
  }

  private async _createCollectionStepFour(
    req: Request,
    res: Response
  ): Promise<void> {
    const files = req.files as
      | Record<string, Express.Multer.File[]>
      | undefined;
    const receiptImage = files?.receiptImage?.[0] ?? null;

    const requestPayload = req.body as TCreateBagStepFour;
    const { id } = req.params;
    const data = await this.userBagService.createCollectionStepFour({
      id: id as string,
      payload: requestPayload,
      receiptImage,
    });
    res.status(200).json({
      success: true,
      status: 200,
      message: 'Create collection step four complete successful',
      data,
    });
    return;
  }

  private async _createCollection(req: Request, res: Response): Promise<void> {
    const user = req.user as IUser;
    const collectionData = req.body as TCreateUserCollection;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    const primaryImage = files?.primaryImage?.[0];
    const receiptImage = files?.receiptImage?.[0];
    const bagImages = files?.images || [];
    const data = await this.userBagService.createCollection({
      user,
      collectionData,
      primaryImage,
      receiptImage,
      bagImages,
    });
    res.status(201).json({
      success: true,
      status: 201,
      message: 'Collection created successfully',
      data,
    });
    return;
  }

  private async _deleteCollection(req: Request, res: Response): Promise<void> {
    const user = req.user as IUser;
    const collection = req.userBagCollection;
    await this.userBagService.deleteCollection({ user, collection });
    res.status(200).json({
      success: true,
      status: 200,
      message: 'Collection deleted successfully',
    });
    return;
  }

  private async _getCollectionById(req: Request, res: Response): Promise<void> {
    const collection = req.userBagCollection;
    const { year } = req.query as { year?: string };
    const data = await this.userBagService.getCollectionById({
      collection,
      year,
    });
    res.status(200).json({
      success: true,
      status: 200,
      message: 'Collection retrieved successfully',
      data,
    });
    return;
  }

  private async _patchCollection(req: Request, res: Response): Promise<void> {
    const user = req.user as IUser;
    const collection = req.userBagCollection;
    const requestUpdateData = req.body as TPatchUserCollection;
    let data: unknown;
    if (requestUpdateData.isEdit) {
      data = await this.userBagService.editCollection({
        user,
        collection,
        requestUpdateData,
      });
    } else {
      data = await this.userBagService.patchCollection({
        user,
        collection,
        requestUpdateData,
      });
    }
    res.status(200).json({
      success: true,
      status: 200,
      message: 'Collection updated successfully',
      data,
    });
    return;
  }

  private async _updateCollection(req: Request, res: Response): Promise<void> {
    const user = req.user as IUser;
    const collection = req.userBagCollection;
    const reqData = req.body;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    const primaryImage = files?.primaryImage?.[0];
    const receiptImage = files?.receiptImage?.[0];
    const bagImages = files?.images || [];
    const data = await this.userBagService.updateCollection({
      user,
      collection,
      reqData,
      primaryImage,
      receiptImage,
      bagImages,
    });
    res.status(200).json({
      success: true,
      status: 200,
      message: 'Collection updated successfully',
      data,
    });
    return;
  }

  private async _getUserCollection(req: Request, res: Response): Promise<void> {
    const user = req.user as IUser;
    const query = req.validatedQuery as TCollectionQuery;
    const data = await this.userBagService.getAllCollections({ query, user });
    res.status(200).json({
      success: true,
      status: 200,
      message: 'Collection retrieved successfully',
      ...data,
    });
    return;
  }

  private async _deleteOneCollectionByAdmin(
    req: Request,
    res: Response
  ): Promise<void> {
    const collection = req.userBagCollection;
    await this.userBagService.deleteOneCollectionByAdmin({ collection });
    res.status(200).json({
      success: true,
      status: 200,
      message: 'Collection deleted successfully',
    });
    return;
  }

  private async _getAllCollectionForAdmin(
    req: Request,
    res: Response
  ): Promise<void> {
    const user = req.user;
    const query = req.validatedQuery as TCollectionQuery;
    const data = await this.userBagService.getAllCollectionsForAdmin({
      user,
      query,
    });
    res.status(200).json({
      success: true,
      status: 200,
      message: 'Collection retrieved successfully',
      ...data,
    });
    return;
  }

  private async _checkBrandModel(req: Request, res: Response): Promise<void> {
    console.log('check brand model payload', req.body);
    const { brandName, modelName } = req.body;
    const data = await this.userBagService.checkBrandModel({
      brandName,
      modelName,
    });
    res.status(200).json({
      success: true,
      status: 200,
      message: 'Brand and model check successful',
      data,
    });
    return;
  }

  private async _changeCollectionCurrentPrice(
    req: Request,
    res: Response
  ): Promise<void> {
    const collection = req.userBagCollection;
    const { priceStatus } = req.body as { priceStatus: TAdminBagPriceStatus };
    const data = await this.userBagService.changeCollectionCurrentPrice({
      priceStatus,
      collection,
    });
    res.status(200).json({
      success: true,
      status: 200,
      message: 'Collection current price updated successfully',
      data,
    });
    return;
  }
}
