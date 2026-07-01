import { Types } from 'mongoose';

import {
  IBrand,
  TActionLink,
  TPaginationLinks,
} from '@/modules/brand/brand.types';
import { IModel } from '@/modules/model/model.types';
import { IYearValue } from '@/modules/userBag/userBag.types';
import { CURRENCIES } from '@/const';

export enum WishPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export enum PurchaseStatus {
  OUT_OF_STOCK = 'out_of_stock',
  ORDERED = 'ordered',
  PURCHASED = 'purchased',
  AVAILABLE = 'available',
}

export interface IPriceDescription {
  currency: string;
  targetPrice: number;
  retailPrice?: number | null;
  marketValue?: number | null;
}

export enum TrendEnum {
  UP = 'up',
  DOWN = 'down',
  STABLE = 'stable',
}

export type Currency = (typeof CURRENCIES)[number];


export type TAdminBagPriceStatus = {
  currentMinValue: number;
  currentMaxValue: number;
  currency: Currency;
  changePercentage: number;
  trend: TrendEnum;
  fetchedAt: string | null;
};

export interface IWishlist {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  brandId: string | IBrand;
  modelId: string | IModel;
  color: string[];
  condition: string;
  material: string;
  hardwareColor: string;
  size: string;
  variant: string;
  specialVariant: string;
  currency: string;
  targetPrice: number;
  priceDescription: IPriceDescription;
  priority: WishPriority;
  note?: string;
  status?: PurchaseStatus;
  priceStatus: TAdminBagPriceStatus;
  image: string;
  createdAt: Date;
  updatedAt: Date;
  imageSearchQuery: string;
  totalListingCount?: number;
}

export type TWishlistActions = {
  create?: TActionLink;
  update?: TActionLink;
  delete?: TActionLink;
};

export type TGetWishlistResponse = {
  data: IWishlist[];
  totalTargetPrice: number;
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    links: TPaginationLinks | null;
    actions?: TWishlistActions;
    showing: string;
  };
};
