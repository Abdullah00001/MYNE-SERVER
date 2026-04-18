import mongoose, { Schema, model, Model } from 'mongoose';

export enum Role {
  ADMIN = 'admin',
  USER = 'user',
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

export enum AccountStatus {
  ACTIVE = 'active',
  BLOCKED = 'blocked',
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, minLength: 4 },
    email: { type: String, required: true },
    avatar: { type: String, default: null },
    isVerified: { type: Boolean, default: false },
    displayName: { type: String, default: null, minLength: 4 },
    accountStatus: { type: String, default: AccountStatus.ACTIVE },
    termsAndPrivacyAcceptedAt: { type: Date, required: true },
    location: { type: String, default: null },
    isTermsAndPrivacyAccepted: { type: Boolean, required: true },
    password: { type: String, minLength: 8,default:null },
    role: { type: String, default: Role.USER },
    phone:{type:String,default:null}
  },
  { timestamps: true }
);

const User: Model<IUser> = model<IUser>('User', UserSchema);

export default User;
