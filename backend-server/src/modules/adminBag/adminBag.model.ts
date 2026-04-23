import { model, Model, Schema, Types } from 'mongoose';

export const CURRENCIES = [
  'EUR',
  'USD',
  'GBP',
  'CHF',
  'JPY',
  'CAD',
  'AUD',
] as const;

export enum TrendEnum {
  UP = 'up',
  DOWN = 'down',
  STABLE = 'stable',
}

export type Currency = (typeof CURRENCIES)[number];

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
  material: string;
  hardwareColor: string;
  size: string;
  condition: string;
  image: string;
  priceStatus: TAdminBagPriceStatus;
  user: Schema.Types.ObjectId;
}

export const PriceStatusSchema = new Schema<TAdminBagPriceStatus>(
  {
    trend: { type: String, enum: TrendEnum, default: null },
    changePercentage: { type: Number, default: null },
    currentValue: { type: Number, default: null },
    currency: {
      type: String,
      enum: CURRENCIES,
      default: 'EUR',
    },
    fetchedAt: { type: String, default: null },
  },
  { _id: false }
);

const AdminBagSchema = new Schema<IAdminBags>(
  {
    bagBrand: {
      type: Types.ObjectId,
      ref: 'Brand',
      required: true,
      index: true,
    },
    bagModel: {
      type: Types.ObjectId,
      ref: 'Model',
      required: true,
      index: true,
    },
    bagColor: { type: String, required: true },
    material: { type: String, required: true },
    hardwareColor: { type: String, default: null },
    size: { type: String, required: true },
    condition: { type: String, default: null },
    image: { type: String, required: true },
    priceStatus: PriceStatusSchema,
    user: { type: Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

const AdminBag: Model<IAdminBags> = model<IAdminBags>(
  'AdminBag',
  AdminBagSchema
);

export default AdminBag;
