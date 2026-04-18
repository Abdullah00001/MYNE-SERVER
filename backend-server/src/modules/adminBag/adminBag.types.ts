import { Schema } from 'mongoose';

import { CURRENCIES } from '@/const';
import { TActionLink, TPaginationLinks } from '@/modules/brand/brand.types';

export enum TrendEnum {
  UP = 'up',
  DOWN = 'down',
  STABLE = 'stable',
}

export type Currency = typeof CURRENCIES[number];

export type TAdminBagPriceStatus = {
  currentValue: number;
  currency: Currency;
  changePercentage: number;
  trend: TrendEnum;
  fetchedAt: string | null;
};

export interface IAdminBags {
  _id: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  bagBrand: Schema.Types.ObjectId;
  bagModel: Schema.Types.ObjectId;
  bagColor: string;
  leatherType: string;
  hardwareColor: string;
  size: string;
  condition: string;
  image: string;
  priceStatus: TAdminBagPriceStatus;
  user: Schema.Types.ObjectId;
}


export type TActions = {
  create?: TActionLink;
  delete?: TActionLink;
};

export type TGetAdminBagsResponse = {
  data: IAdminBags[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    links: TPaginationLinks | null;
    actions?: TActions;
    showing: string;
  };
};