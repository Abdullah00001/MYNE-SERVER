import { Schema } from 'mongoose';

import { BaseDTO } from '@/core/base_classes/dto.base';
import { IAdminBags, TrendEnum } from '@/modules/adminBag/adminBag.types';
import { CURRENCIES } from '@/const';
import { IUserBag } from '@/modules/userBag/userBag.types';

export type Currency = (typeof CURRENCIES)[number];

export class CreateAdminBagDTO extends BaseDTO<IUserBag> {
  // public _id: Schema.Types.ObjectId;
  // public bagBrand: Schema.Types.ObjectId;
  // public bagModel: Schema.Types.ObjectId;
  // public image: string;
  public variant: string;
  public priceStatus: {
    currentValue: number;
    currency: Currency;
    changePercentage: number;
    trend: TrendEnum;
    fetchedAt: string | null;
  };
  public createdAt: Date;
  public updatedAt: Date;
  constructor(adminBag: IUserBag) {
    super(adminBag);
    // this.bagBrand = adminBag.brandId;
    // this.bagModel = adminBag.modelId;
    // this.image = adminBag.image;
    this.priceStatus = adminBag.priceStatus;
    this.createdAt = adminBag.createdAt;
    this.updatedAt = adminBag.updatedAt;
    // this._id = adminBag._id;
    this.variant = adminBag.variant;
  }
}
