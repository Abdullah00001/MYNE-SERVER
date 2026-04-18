import { Request, Response, RequestHandler } from 'express';
import { JwtPayload } from 'jsonwebtoken';
import { injectable } from 'tsyringe';

import { BaseController } from '@/core/base_classes/base.controller';
import { BrandService } from '@/modules/brand/brand.services';

@injectable()
export class BrandController extends BaseController {
  public getBrands: RequestHandler;
  public createBrand: RequestHandler;
  public deleteBrand: RequestHandler;
  public searchBrand: RequestHandler;
  public editBrandName: RequestHandler;
  public editBrandInfo: RequestHandler;

  constructor(private readonly brandService: BrandService) {
    super();
    this.getBrands = this.wrap(this._getBrands);
    this.createBrand = this.wrap(this._createBrand);
    this.deleteBrand = this.wrap(this._deleteBrand);
    this.searchBrand = this.wrap(this._searchBrand);
    this.editBrandName = this.wrap(this._editBrandName);
    this.editBrandInfo = this.wrap(this._editBrandInfo);
  }

  private async _getBrands(req: Request, res: Response): Promise<void> {
    const user = req.user;
    const params = req.query as { page: string | null; limit: string | null };
    const data = await this.brandService.getBrands({ params, user });
    res.status(200).json({
      success: true,
      status: 200,
      message: 'Brand retrieve successful',
      ...data,
    });
    return;
  }

  private async _createBrand(req: Request, res: Response): Promise<void> {
    const { brandName } = req.body;
    const fileName = req?.file?.filename as string;
    const mimeType = req?.file?.mimetype as string;
    const user = req.user as JwtPayload;
    const data = await this.brandService.createBrand({
      brandName,
      fileName,
      mimeType,
      user,
    });
    res.status(201).json({
      success: true,
      status: 201,
      message: 'Brand create successful',
      data,
    });
    return;
  }

  private async _deleteBrand(req: Request, res: Response): Promise<void> {
    const brand = req.brand;
    await this.brandService.deleteBrand({ brand });
    res.status(200).json({
      success: true,
      status: 200,
      message: 'Brand delete successful',
    });
    return;
  }

  private async _searchBrand(req: Request, res: Response): Promise<void> {
    const user = req.user;
    const { query } = req.query;
    if (!query || typeof query !== 'string') {
      res.status(400).json({
        success: false,
        status: 400,
        message: 'Query parameter is required',
      });
      return;
    }
    const data = await this.brandService.searchBrand({
      brandName: query as string,
      user,
    });
    res.status(200).json({
      success: true,
      status: 200,
      message: 'Brand Search successful',
      data,
    });
    return;
  }

  private async _editBrandName(req: Request, res: Response): Promise<void> {
    const { brandName } = req.body;
    const brand = req.brand;
    const data = await this.brandService.editBrandName({ brandName, brand });
    res.status(200).json({
      success: true,
      status: 200,
      message: 'Brand Info Update successful',
      data,
    });
    return;
  }

  private async _editBrandInfo(req: Request, res: Response): Promise<void> {
    const { brandName } = req.body;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const file = files?.brandLogo?.[0];
    const fileName = file?.filename;
    const mimeType = file?.mimetype;
    const brand = req.brand;

    const data = await this.brandService.editBrandInfo({
      brand,
      fileName,
      mimeType,
      brandName,
    });

    res.status(200).json({
      success: true,
      status: 200,
      message: 'Brand Info Update successful',
      data,
    });
  }
}
