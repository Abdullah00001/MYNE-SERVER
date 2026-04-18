import { BaseDTO } from '@/core/base_classes/dto.base';
import { IBrand } from '@/modules/brand/brand.types';

export class GetBrandForUSerDTO extends BaseDTO<IBrand> {
  public _id: string;
  public brandName: string;

  constructor(brand: IBrand) {
    super(brand);
    this._id = String(brand._id);
    this.brandName = brand.brandName;
  }
}

export class GetBrandForAdminDTO extends BaseDTO<IBrand> {
  public _id: string;
  public brandName: string;
  public brandLogo: string;

  constructor(brand: IBrand) {
    super(brand);
    this._id = String(brand._id);
    this.brandName = brand.brandName;
    this.brandLogo = brand.brandLogo;
  }
}
