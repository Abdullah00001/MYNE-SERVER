import { Request, Response, RequestHandler } from 'express';
import { JwtPayload } from 'jsonwebtoken';
import { injectable } from 'tsyringe';

import { BaseController } from '@/core/base_classes/base.controller';
import { AdminBagService } from '@/modules/adminBag/adminBag.services';
import { IUser } from '@/modules/auth/auth.types';
import {
  TCreateAdminBagPayload,
  TUpdateAdminBagPayload,
} from '@/modules/adminBag/adminBag.schemas';

@injectable()
export class AdminBagController extends BaseController {
  public createAdminBag: RequestHandler;
  public getAdminBags: RequestHandler;
  public deleteAdminBag: RequestHandler;
  public updateAdminBag: RequestHandler;
  public getOneAdminBag: RequestHandler;

  constructor(private readonly adminBagService: AdminBagService) {
    super();
    this.createAdminBag = this.wrap(this._createAdminBag);
    this.getAdminBags = this.wrap(this._getAdminBags);
    this.deleteAdminBag = this.wrap(this._deleteAdminBag);
    this.updateAdminBag = this.wrap(this._updateAdminBag);
    this.getOneAdminBag = this.wrap(this._getOneAdminBag);
  }

  private async _createAdminBag(req: Request, res: Response): Promise<void> {
    const user = req.user as JwtPayload;
    const payload = req.body as TCreateAdminBagPayload;
    const files = req.file as Express.Multer.File;
    const fileName = files.filename;
    const data = await this.adminBagService.createAdminBag({
      payload,
      file: fileName,
      user,
    });
    res.status(201).json({
      success: true,
      status: 201,
      message: 'Admin Bag Creation Successful',
      data,
    });
    return;
  }

  private async _getAdminBags(req: Request, res: Response): Promise<void> {
    const user = req.user as JwtPayload | IUser;
    const { page, limit } = req.query as { page?: string; limit?: string };
    const data = await this.adminBagService.getAdminBags({ page, limit, user });
    res.status(200).json({
      success: true,
      status: 200,
      message: 'Admin Bags Fetched Successfully',
      ...data,
    });
    return;
  }

  private async _deleteAdminBag(req: Request, res: Response): Promise<void> {
    const bag = req.adminBag;
    await this.adminBagService.deleteAdminBag({ bag });
    res.status(200).json({
      success: true,
      status: 200,
      message: 'Admin Bag Deleted Successfully',
    });
    return;
  }

  private async _updateAdminBag(req: Request, res: Response): Promise<void> {
    const bag = req.adminBag;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const file = files?.bagImage?.[0];
    const data = await this.adminBagService.updateAdminBag({
      bag,
      file: file?.filename,
    });
    res.status(200).json({
      success: true,
      status: 200,
      message: 'Admin Bag Updated Successfully',
      data,
    });
    return;
  }

  private async _getOneAdminBag(req: Request, res: Response): Promise<void> {
    const { year } = req.query as { year?: string };
    const collection = req.adminBag;
    const data = await this.adminBagService.getOneAdminBag({
      collection,
      year,
    });
    console.log(data);
    res.status(200).json({
      success: true,
      status: 200,
      message: 'One Admin Bags Retrieve Successful',
      data,
    });
    return;
  }
}
