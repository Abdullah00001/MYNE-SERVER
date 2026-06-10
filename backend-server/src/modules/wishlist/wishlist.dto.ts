import { BaseDTO } from '@/core/base_classes/dto.base';
import { IBrand } from '@/modules/brand/brand.types';
import { IModel } from '@/modules/model/model.types';
import { IWishlist } from '@/modules/wishlist/wishlist.types';

export class CreateWishDTO extends BaseDTO<IWishlist> {
  public _id: string;
  public userId: string;
  public brand: string | IBrand;
  public model: string | IModel;
  public priority: string;
  public color: string | string[];
  public material: string;
  public note?: string;
  public priceDescription: {
    currency: string;
    targetPrice: number;
    retailPrice: number | null;
    marketValue: number | null;
  };
  public image: string;
  public status: string;

  constructor(data: IWishlist) {
    super(data);
    this._id = data._id.toString();
    this.userId = data.userId.toString();
    this.brand = data.brandId;
    this.model = data.modelId;
    this.priority = data.priority;
    this.color = data.color;
    this.material = data.material;
    this.note = data.note;
    this.priceDescription = {
      currency: data.priceDescription.currency,
      targetPrice: data.priceDescription.targetPrice,
      retailPrice: data.priceDescription.retailPrice!,
      marketValue: data.priceDescription.marketValue!,
    };
    this.image = data.image;
    this.status = data.status!;
  }
}

export class GetWishDTO extends BaseDTO<IWishlist> {
  public _id: string;
  public userId: string;
  public brand: IBrand;
  public model: IModel;
  public priority: string;
  public color: string | string[];
  public priceDescription: {
    currency: string;
    targetPrice: number;
    retailPrice: number | null;
    marketValue: number | null;
  };
  public image: string;
  public status: string;
  public createdAt: Date;
  public updatedAt: Date;
  constructor(data: IWishlist) {
    super(data);
    this._id = data._id.toString();

    this.userId = data.userId.toString();
    this.brand = data.brandId as IBrand;
    this.model = data.modelId as IModel;
    this.priceDescription = {
      currency: data.priceDescription.currency,
      targetPrice: data.priceDescription.targetPrice,
      retailPrice: data.priceDescription.retailPrice!,
      marketValue: data.priceDescription.marketValue!,
    };
    this.image = data.image;
    this.status = data.status!;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    this.priority = data.priority;
    this.color = data.color;
  }
}
