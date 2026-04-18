import { BaseDTO } from '@/core/base_classes/dto.base';
import { IUser } from '@/modules/auth/auth.types';

export class CreateUserResponseDTO extends BaseDTO<IUser> {
  public _id: string;
  public name: string;
  public email: string;
  public role: string;
  public isVerified: boolean;
  public accountStatus: string;
  public isTermsAndPrivacyAccepted: boolean;
  public termsAndPrivacyAcceptedAt: Date;
  constructor(user: IUser) {
    super(user);
    this._id = String(user._id);
    this.accountStatus = user.accountStatus;
    this.email = user.email;
    this.role = user.role;
    this.name = user.name;
    this.isTermsAndPrivacyAccepted = user.isTermsAndPrivacyAccepted;
    this.termsAndPrivacyAcceptedAt = user.termsAndPrivacyAcceptedAt;
    this.isVerified = user.isVerified;
  }
}
