import { Types } from 'mongoose';

import {
  IBrand,
  TActionLink,
  TPaginationLinks,
} from '@/modules/brand/brand.types';
import { IModel } from '@/modules/model/model.types';

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
  image: string;
  createdAt: Date;
  updatedAt: Date;
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
