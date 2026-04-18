import { BaseDTO } from '@/core/base_classes/dto.base';
import { IUser } from '@/modules/auth/auth.types';

export class UserProfileInfoResponseDTO extends BaseDTO<IUser> {
  public name: string;
  public email: string;
  public displayName: string | null;
  public avatar: string | null;
  public location: string | null;

  constructor(user: IUser) {
    super(user);
    this.name = user.name;
    this.email = user.email;
    this.displayName = user.displayName;
    this.avatar = user.avatar;
    this.location = user.location;
  }
}

export class AdminProfileInfoResponseDTO extends BaseDTO<IUser> {
  public name: string;
  public email: string;
  public phone: string | null;
  public avatar: string | null;
  public location: string | null;

  constructor(user: IUser) {
    super(user);
    this.name = user.name;
    this.email = user.email;
    this.phone = user.phone;
    this.avatar = user.avatar;
    this.location = user.location;
  }
}
