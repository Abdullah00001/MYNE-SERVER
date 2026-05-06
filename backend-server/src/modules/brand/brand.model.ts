import { Schema, Model, model } from 'mongoose';

import { IBrand } from '@/modules/brand/brand.types';

const mongoObjectIdRegex = /^[a-fA-F0-9]{24}$/;

const BrandSchema = new Schema<IBrand>(
  {
    brandLogo: { type: String, default: null },
    brandName: {
      type: String,
      minLength: [3, 'Brand name must be at least 3 characters'],
      required: true,
      trim: true,
      index: true,
      unique: true,
      validate: {
        validator: (value: string): boolean => !mongoObjectIdRegex.test(value),
        message: 'Brand name cannot be a MongoDB ObjectId',
      },
    },
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
