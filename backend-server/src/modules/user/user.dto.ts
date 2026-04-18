import { BaseDTO } from '@/core/base_classes/dto.base';
import { IUser } from '@/modules/auth/auth.types';

export class GetUsersResponseDTO extends BaseDTO<IUser> {
  public _id: string;
  public name: string;
  public accountStatus: string;
  public avatar: string;
  public createdAt: Date;
  public role: string;
  public email: string;
  constructor(user: IUser) {
    super(user);
    this._id = String(user._id);
    this.accountStatus = user.accountStatus;
    this.role = user.role;
    this.name = user.name;
    this.createdAt = user.createdAt as Date;
    this.avatar = user.avatar;
    this.email = user.email;
  }
}

export class GetSingleUserResponseDTO extends BaseDTO<IUser> {
  public _id: string;
  public name: string;
  public accountStatus: string;
  public avatar: string;
  public createdAt: Date;
  public email: string;
  public location: string;
  constructor(user: IUser) {
    super(user);
    this._id = String(user._id);
    this.accountStatus = user.accountStatus;
    this.name = user.name;
    this.createdAt = user.createdAt as Date;
    this.avatar = user.avatar;
    this.email = user.email;
    this.location=user.location
  }
}
