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
  bagColor: string[];
  material: string;
  hardwareColor: string;
  size: string;
  priceStatus: TAdminBagPriceStatus;
  wearChecklist: string[];
  // productionYear: number;
  yearsOfBag: string;
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
  specialVariant: string;
  imageSearchQuery: string;
  isAdmin: boolean;
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

interface PriceRange {
  min: number;
  max: number;
}

interface Source {
  type: string;
  sites: string[];
}

interface MarketSearchResult {
  eur: number;
  original: number;
  currency: string;
  source: string;
  url: string;
  title: string;
}

interface MarketSources {
  Search_Results: MarketSearchResult[];
}

interface PriceHistoryEntry {
  period: string;
  avg_price: number;
}

interface PriceHistory {
  history: PriceHistoryEntry[];
}

export interface ValuationResponse {
  current_value: number | undefined;
  currency: string | undefined;
  confidence: string | undefined;
  trend: string;
  price_range: PriceRange | undefined;
  retail_price: number | undefined;
  color_premium: boolean | undefined;
  data_points: number | undefined;
  sources_used: Source[];
  market_sources: MarketSources | undefined;
  change_percentage: number | undefined;
  change_basis: string | undefined;
  purchase_price: number | undefined;
  price_history: PriceHistory | undefined;
}
