import { Model, Schema, model } from 'mongoose';

import { IColor } from '@/modules/colors/colors.types';

const mongoObjectIdRegex = /^[a-fA-F0-9]{24}$/;

const ColorSchema = new Schema<IColor>(
  {
    colorName: {
      type: String,
      required: true,
      trim: true,
      minLength: [2, 'Color name must be at least 2 characters'],
      maxLength: [50, 'Color name must not exceed 50 characters'],
      unique: true,
      index: true,
      validate: {
        validator: (value: string): boolean => !mongoObjectIdRegex.test(value),
        message: 'Color name cannot be a MongoDB ObjectId',
      },
    },
  },
  { timestamps: true }
);

const Color: Model<IColor> = model<IColor>('Color', ColorSchema);

export default Color;
