import { model, Schema, Model } from 'mongoose';

import {
  ITermAndCondition,
  IPrivacyAndPolicy,
} from '@/modules/legal/legal.types';

const TermAndConditionSchema = new Schema<ITermAndCondition>(
  {
    description: { type: String },
  },
  { timestamps: true }
);

const PrivacyAndPolicySchema = new Schema<IPrivacyAndPolicy>(
  {
    description: { type: String },
  }, 
  { timestamps: true }
);

const TermAndCondition: Model<ITermAndCondition> = model<ITermAndCondition>(
  'termandcondition',
  TermAndConditionSchema
);

const PrivacyAndPolicy: Model<IPrivacyAndPolicy> = model<IPrivacyAndPolicy>(
  'privacyandpolicy',
  PrivacyAndPolicySchema
);

export { TermAndCondition, PrivacyAndPolicy };
