import { Schema } from 'mongoose';

import { BaseDTO } from '@/core/base_classes/dto.base';
import { IAdminBags, TrendEnum } from '@/modules/adminBag/adminBag.types';
import { CURRENCIES } from '@/const';

export type Currency = (typeof CURRENCIES)[number];

export class CreateAdminBagDTO extends BaseDTO<IAdminBags> {
  public _id: Schema.Types.ObjectId;
  public bagBrand: Schema.Types.ObjectId;
  public bagModel: Schema.Types.ObjectId;
  public image: string;
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
  constructor(adminBag: IAdminBags) {
    super(adminBag);
    this.bagBrand = adminBag.bagBrand;
    this.bagModel = adminBag.bagModel;
    this.image = adminBag.image;
    this.priceStatus = adminBag.priceStatus;
    this.createdAt = adminBag.createdAt;
    this.updatedAt = adminBag.updatedAt;
    this._id = adminBag._id;
    this.variant = adminBag.variant;
  }
}
