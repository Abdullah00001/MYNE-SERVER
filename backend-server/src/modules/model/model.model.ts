import { model, Schema, Model } from 'mongoose';

import { IModel } from '@/modules/model/model.types';

const mongoObjectIdRegex = /^[a-fA-F0-9]{24}$/;

const ModelSchema = new Schema<IModel>(
  {
    modelName: {
      type: String,
      required: true,
      minLength: [3, 'Model name must be at least 3 characters'],
      trim: true,
      index: true,
      unique: true,
      validate: {
        validator: (value: string): boolean => !mongoObjectIdRegex.test(value),
        message: 'Model name cannot be a MongoDB ObjectId',
      },
    },
    brandId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'Brand',
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    modelImage: { type: String, default: null },
  },
  { timestamps: true }
);

const ModelModel: Model<IModel> = model<IModel>('Model', ModelSchema);

export default ModelModel;
