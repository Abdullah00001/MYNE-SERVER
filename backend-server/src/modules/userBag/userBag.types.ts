import { Types } from 'mongoose';

import { TAdminBagPriceStatus } from '@/modules/adminBag/adminBag.types';
import { TPaginationLinks } from '@/modules/blog/blog.types';
import { IBrand, TActionLink } from '@/modules/brand/brand.types';
import { IModel } from '@/modules/model/model.types';

export enum PublishStatus {
  PENDING = 'pending',
  PUBLISHED = 'published',
}

export interface IMonthValue {
  currency: string | null;
  avg_price: number | null;
}

export interface IYearValue {
  january: IMonthValue;
  february: IMonthValue;
  march: IMonthValue;
  april: IMonthValue;
  may: IMonthValue;
  june: IMonthValue;
  july: IMonthValue;
  august: IMonthValue;
  september: IMonthValue;
  october: IMonthValue;
  november: IMonthValue;
  december: IMonthValue;
}

export interface IUserBag {
  brandId: Types.ObjectId | IBrand;
  modelId: Types.ObjectId | IModel;
  userId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  _id: Types.ObjectId;
  primaryImage: string;
  images: string[];
  bagColor: string;
  material: string;
  hardwareColor: string;
  size: string;
  priceStatus: TAdminBagPriceStatus;
  // productionYear: number;
  condition: string;
  purchasePrice: number;
  sellerName: string;
  currency: string;
  variant: string;
  purchaseLocation: string;
  purchaseDate: Date;
  purchaseType: string;
  waitingTime?: string | null;
  notes?: string | null;
  receipt?: string | null;
  isArchived: boolean;
  publishStatus: PublishStatus;
  historicalValue?: Record<string, IYearValue> | Map<string, IYearValue>;
  __v?: number;
}

export type TFileInfo = {
  filePath: string;
  mimeType: string;
  key: string;
};

type TSkipStage = { $skip: number };
type TLimitStage = { $limit: number };

export type TSkipAndLimitPipelineStage = TSkipStage | TLimitStage;

export type TCollectionsActions = {
  create?: TActionLink;
  update_with_image?: TActionLink;
  update_only_text?: TActionLink;
  delete?: TActionLink;
  getOne?: TActionLink;
};

export type TGetCollectionsResponse = {
  data: IUserBag[];
  meta: {
    total: number;
    totalValue?: number;
    totalCost?: number;
    page: number;
    limit: number;
    totalPages: number;
    links: TPaginationLinks | null;
    actions?: TCollectionsActions;
    showing: string;
  };
};

export type IUserBagResponse = IUserBag & {
  historicalValueYears: string[];
  aiSuggestedPrice: number;
};
