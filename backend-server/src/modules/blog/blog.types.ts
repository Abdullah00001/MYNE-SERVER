import mongoose from 'mongoose';

import { GetBlogDTO } from '@/modules/blog/blog.dto';

export interface IBlog {
  blogTitle: string;
  blogImage: string;
  blogDescription: string;
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

export type TBlogActions = {
  create?: TActionLink;
  update_with_image?: TActionLink;
  update_without_image?: TActionLink;
  delete?: TActionLink;
};

export type TGetBlogResponse = {
  data: GetBlogDTO[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    links: TPaginationLinks | null;
    actions?: TBlogActions;
    showing: string;
  };
};
