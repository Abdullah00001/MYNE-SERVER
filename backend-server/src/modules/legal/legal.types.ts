import mongoose from 'mongoose';

export interface ITermAndCondition {
  _id: mongoose.Schema.Types.ObjectId;
  description: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IPrivacyAndPolicy {
  _id: mongoose.Schema.Types.ObjectId;
  description: string;
  createdAt?: Date;
  updatedAt?: Date;
}
