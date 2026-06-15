import mongoose from 'mongoose';

import type { GetColorDTO } from '@/modules/colors/colors.dto';

export interface IColor {
  colorName: string;
  _id: mongoose.Schema.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

export type TGetColorsResponse = {
  data: GetColorDTO[];
  meta: {
    totalColors: number;
    totalPages: number;
    links: {
      currentPage: number;
      nextPage: number | null;
      previousPage: number | null;
      firstPage: number;
      lastPage: number;
    };
  };
};
