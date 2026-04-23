import { Request, Response, RequestHandler } from 'express';
import { JwtPayload } from 'jsonwebtoken';
import { injectable } from 'tsyringe';

import { BaseController } from '@/core/base_classes/base.controller';
import { GetModelDTO } from '@/modules/model/model.dto';
import { ModelService } from '@/modules/model/model.services';
import { IUser } from '@/modules/auth/auth.types';

@injectable()
export class ModelController extends BaseController {
  public createModel: RequestHandler;
  public updateModelWithImage: RequestHandler;
  public updateModelWithoutImage: RequestHandler;
  public deleteModel: RequestHandler;
  public getSingleModel: RequestHandler;
  public getModels: RequestHandler;
  public searchModel: RequestHandler;
  public createModelByUser: RequestHandler;

  constructor(private readonly modelService: ModelService) {
    super();
    this.createModel = this.wrap(this._createModel);
    this.updateModelWithImage = this.wrap(this._updateModelWithImage);
    this.updateModelWithoutImage = this.wrap(this._updateModelWithoutImage);
    this.deleteModel = this.wrap(this._deleteModel);
    this.getSingleModel = this.wrap(this._getSingleModel);
    this.getModels = this.wrap(this._getModels);
    this.searchModel = this.wrap(this._searchModel);
    this.createModelByUser = this.wrap(this._createModelByUser);
  }

  private async _createModel(req: Request, res: Response): Promise<void> {
    const fileName = req.file?.filename as string;
    const mimeType = req.file?.mimetype as string;
    const user = req.user as JwtPayload;
    const { modelName, brandId } = req.body;
    const data = await this.modelService.createModel({
      brandId,
      fileName,
      mimeType,
      modelName,
      user,
    });
    res.status(201).json({
      success: true,
      status: 201,
      message: 'Model create successful',
      data,
    });
    return;
  }

  private async _updateModelWithImage(
    req: Request,
    res: Response
  ): Promise<void> {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const file = files?.modelImage?.[0];
    const fileName = file?.filename;
    const mimeType = file?.mimetype;
    const model = req.model;
    const { modelName } = req.body;

    const data = await this.modelService.updateModelWithImage({
      fileName,
      mimeType,
      modelName,
      model,
    });

    res.status(200).json({
      success: true,
      status: 200,
      message: 'Model update successful',
      data,
    });
  }

  private async _updateModelWithoutImage(
    req: Request,
    res: Response
  ): Promise<void> {
    const model = req.model;
    const { modelName } = req.body;
    const data = await this.modelService.updateModelWithoutImage({
      modelName,
      model,
    });
    res.status(200).json({
      success: true,
      status: 200,
      message: 'Model update successful',
      data,
    });
    return;
  }

  private async _deleteModel(req: Request, res: Response): Promise<void> {
    const model = req.model;
    await this.modelService.deleteModel({
      model,
    });
    res.status(200).json({
      success: true,
      status: 200,
      message: 'Model delete successful',
    });
    return;
  }

  private async _getSingleModel(req: Request, res: Response): Promise<void> {
    const model = req.model;
    res.status(200).json({
      success: true,
      status: 200,
      message: 'Model retrieve successful',
      data: GetModelDTO.fromEntity(model),
    });
    return;
  }

  private async _getModels(req: Request, res: Response): Promise<void> {
    const user = req.user;

    const params = req.query as {
      page?: string;
      limit?: string;
      search?: string;
      brandId?: string;
    };
    const data = await this.modelService.getModels({ params, user });
    res.status(200).json({
      success: true,
      status: 200,
      message: 'Models retrieve successful',
      ...data,
    });
    return;
  }

  private async _createModelByUser(req: Request, res: Response): Promise<void> {
    const user = req.user as IUser;
    const { modelName, brandId } = req.body;
    const data = await this.modelService.createBrandByUser({
      brandId,
      modelName,
      user,
    });
    res.status(200).json({
      success: true,
      status: 200,
      message: 'Model create by user successful',
      data,
    });
    return;
  }

  private async _searchModel(req: Request, res: Response): Promise<void> {
    const { query } = req.query;
    if (!query || typeof query !== 'string') {
      res.status(400).json({
        success: false,
        status: 400,
        message: 'Query parameter is required',
      });
      return;
    }
    // TODO - Call here search service
    const data = await this.modelService.searchModel({
      modelName: query as string,
    });
    res.status(200).json({
      success: true,
      status: 200,
      message: 'Models search successful',
      data,
    });
    return;
  }
}
