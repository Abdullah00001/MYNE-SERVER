import { Schema, Model, model } from 'mongoose';

import {
  IWishlist,
  IPriceDescription,
} from '@/modules/wishlist/wishlist.types';

const PriceDescriptionSchema = new Schema<IPriceDescription>(
  {
    currency: { type: String, required: true },
    targetPrice: { type: Number, required: true },
    retailPrice: { type: Number, default: null },
    marketValue: { type: Number, default: null },
  },
  { _id: false }
);

const WishlistSchema = new Schema<IWishlist>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    brandId: {
      type: Schema.Types.ObjectId,
      ref: 'Brand',
      required: true,
      index: true,
    },
    modelId: {
      type: Schema.Types.ObjectId,
      ref: 'Model',
      required: true,
      index: true,
    },
    color: [{ type: String, required: true }],
    condition: { type: String, required: true },
    material: { type: String, required: true },
    hardwareColor: { type: String, required: true },
    size: { type: String, required: true },
    variant: { type: String, default: null },
    specialVariant: { type: String, default: null },
    priority: { type: String, enum: ['low', 'medium', 'high'], required: true },
    note: { type: String, default: null },
    status: {
      type: String,
      enum: ['out_of_stock', 'ordered', 'purchased', 'available'],
      default: 'available',
    },
    image: { type: String, required: true },
    currency: { type: String, required: true },
    targetPrice: { type: Number, default: null },
  },
  { timestamps: true }
);

const Wishlist: Model<IWishlist> = model<IWishlist>('Wishlist', WishlistSchema);

export default Wishlist;
