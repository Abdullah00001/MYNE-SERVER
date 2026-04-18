import mongoose from 'mongoose';

export interface IBrand {
  brandName: string;
  brandLogo: string;
  createdBy?: mongoose.Schema.Types.ObjectId;
  _id: mongoose.Schema.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

export type TPaginationLinks = {
  first: string;
  last: string;
  previous: string | null;
  next: string | null;
  current: string;
};

export type TActionLink = {
  href: string;
  method: string;
};

export type TBrandActions = {
  create?: TActionLink;
  update?: TActionLink;
  delete?: TActionLink;
};

export type TGetBrandsResponse = {
  data: IBrand[];
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
