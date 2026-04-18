import { JwtPayload } from 'jsonwebtoken';
import mongoose from 'mongoose';

import { Role } from '@/types/jwt.types';

export enum AccountStatus {
  ACTIVE = 'active',
  BLOCKED = 'blocked',
}

export enum AuthErrorType {
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  TOKEN_BLACKLISTED = 'TOKEN_BLACKLISTED',
  USER_BLOCKED = 'USER_BLOCKED',
}

export interface IUser {
  _id: mongoose.Schema.Types.ObjectId;
  name: string;
  displayName: string;
  email: string;
  password: string;
  role: Role;
  isVerified: boolean;
  accountStatus: AccountStatus;
  isTermsAndPrivacyAccepted: boolean;
  termsAndPrivacyAcceptedAt: Date;
  location: string;
  avatar: string;
  createdAt?: Date;
  updatedAt?: Date;
  rememberMe?: boolean;
  phone:string
}

export type TVerifyOtp = {
  user: JwtPayload;
  jwt?: string;
};
