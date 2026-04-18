import { Schema, Model, model } from 'mongoose';

import { IBrand } from '@/modules/brand/brand.types';

const BrandSchema = new Schema<IBrand>(
  {
    brandLogo: { type: String, default: null },
    brandName: { type: String, minLength: 4, required: true, index: true,unique: true },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

const Brand: Model<IBrand> = model<IBrand>('Brand', BrandSchema);

export default Brand;
