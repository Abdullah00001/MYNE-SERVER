import { Schema } from 'mongoose';

import { TActionLink, TPaginationLinks } from '@/modules/brand/brand.types';

export interface IModel {
  modelName: string;
  brandId: Schema.Types.ObjectId;
  _id: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  modelImage: string;
  createdBy:Schema.Types.ObjectId
}


export type TBrandActions = {
  create?: TActionLink;
  update?: TActionLink;
  delete?: TActionLink;
};

export type TGetModelResponse = {
  data: IModel[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    links: TPaginationLinks | null;
    actions?: TBrandActions;
    showing: string;
  };
};