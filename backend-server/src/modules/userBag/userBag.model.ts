import { Schema, model, Model } from 'mongoose';

import { PriceStatusSchema } from '@/modules/adminBag/adminBag.model';
import { IUserBag, PublishStatus } from '@/modules/userBag/userBag.types';

const MonthValueSchema = new Schema(
  {
    currency: { type: String, default: null },
    avg_price: { type: Number, default: null },
  },
  { _id: false }
);

const YearSchema = new Schema(
  {
    january: {
      type: MonthValueSchema,
      default: () => ({ currency: null, avg_price: null }),
    },
    february: {
      type: MonthValueSchema,
      default: () => ({ currency: null, avg_price: null }),
    },
    march: {
      type: MonthValueSchema,
      default: () => ({ currency: null, avg_price: null }),
    },
    april: {
      type: MonthValueSchema,
      default: () => ({ currency: null, avg_price: null }),
    },
    may: {
      type: MonthValueSchema,
      default: () => ({ currency: null, avg_price: null }),
    },
    june: {
      type: MonthValueSchema,
      default: () => ({ currency: null, avg_price: null }),
    },
    july: {
      type: MonthValueSchema,
      default: () => ({ currency: null, avg_price: null }),
    },
    august: {
      type: MonthValueSchema,
      default: () => ({ currency: null, avg_price: null }),
    },
    september: {
      type: MonthValueSchema,
      default: () => ({ currency: null, avg_price: null }),
    },
    october: {
      type: MonthValueSchema,
      default: () => ({ currency: null, avg_price: null }),
    },
    november: {
      type: MonthValueSchema,
      default: () => ({ currency: null, avg_price: null }),
    },
    december: {
      type: MonthValueSchema,
      default: () => ({ currency: null, avg_price: null }),
    },
  },
  { _id: false }
);

const UserCollectionSchema = new Schema<IUserBag>(
  {
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
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    primaryImage: { type: String, default: null },
    images: [{ type: String }],
    bagColor: { type: String, required: true },
    material: { type: String, required: true },
    hardwareColor: { type: String, default: null },
    size: { type: String, required: true },
    priceStatus: { type: PriceStatusSchema, default: null },
    // productionYear: { type: Number, required: true },
    condition: { type: String, default: null },
    purchasePrice: { type: Number, default: null },
    currency: { type: String, default: null },
    purchaseLocation: { type: String, default: null },
    sellerName: { type: String, default: null },
    purchaseDate: { type: Date, default: null },
    purchaseType: { type: String, default: null },
    waitingTime: { type: String, default: null },
    notes: { type: String, default: null },
    receipt: { type: String, default: null },
    isArchived: { type: Boolean, default: false },
    publishStatus: {
      type: String,
      enum: PublishStatus,
      default: PublishStatus.PENDING,
    },
    historicalValue: {
      type: Map,
      of: YearSchema,
      default: null,
    },
  },
  { timestamps: true }
);

const UserCollection: Model<IUserBag> = model<IUserBag>(
  'UserCollection',
  UserCollectionSchema
);

export default UserCollection;
