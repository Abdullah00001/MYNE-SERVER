import { join, extname } from 'path';

import { injectable } from 'tsyringe';

import User from '@/modules/auth/auth.model';
import { IUser } from '@/modules/auth/auth.types';
import {
  AdminProfileInfoResponseDTO,
  UserProfileInfoResponseDTO,
} from '@/modules/profile/profile.dto';
import { TUpdateUserProfileInfo } from '@/modules/profile/profile.schemas';
import { Role } from '@/types/jwt.types';
import { PasswordUtils } from '@/utils/password.utils';
import { S3Utils } from '@/utils/s3.utils';
import { SystemUtils } from '@/utils/system.utils';

@injectable()
export class ProfileService {
  constructor(
    private readonly s3Utils: S3Utils,
    private readonly systemUtils: SystemUtils,
    private readonly passwordUtils: PasswordUtils
  ) {}

  async uploadAvatar({
    fileName,
    user,
    mimeType,
  }: {
    user: IUser;
    fileName: string;
    mimeType: string;
  }): Promise<string> {
    try {
      const filePath = join(__dirname, '../../../public/temp', fileName);
      const fileExtension = extname(filePath);
      const s3Key = `avatars/${user._id}/${Date.now()}${fileExtension}`;
      if (user.avatar) {
        const key = this.systemUtils.extractS3KeyFromUrl(user.avatar);
        await this.s3Utils.singleDelete({ key });
      }
      const url = await this.s3Utils.singleUpload({
        filePath,
        key: s3Key,
        mimeType,
      });
      await User.findByIdAndUpdate(user._id, { $set: { avatar: url } });
      return url;
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('Unknown Error Occurred In Upload Avatar Service');
    }
  }

  async deleteAvatar({ user }: { user: IUser }): Promise<void> {
    try {
      if (user.avatar) {
        const key = this.systemUtils.extractS3KeyFromUrl(user.avatar);
        await this.s3Utils.singleDelete({ key });
        await User.findByIdAndUpdate(user._id, { $set: { avatar: null } });
      }
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('Unknown Error Occurred In Delete Avatar Service');
    }
  }

  async changePassword({
    password,
    user,
  }: {
    password: string;
    user: IUser;
  }): Promise<void> {
    try {
      const { _id } = user;
      const hashPassword = await this.passwordUtils.hashPassword(password);
      await User.findByIdAndUpdate(_id, { $set: { password: hashPassword } });
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('Unknown Error Occurred In Change Password Service');
    }
  }

  async changeUserProfileInfo({
    user,
    userData,
  }: {
    userData: TUpdateUserProfileInfo;
    user: IUser;
  }): Promise<TUpdateUserProfileInfo> {
    try {
      const { name, displayName, location, phone } = userData;
      const data = await User.findByIdAndUpdate(
        user?._id,
        {
          $set: { name, displayName, location, phone },
        },
        { new: true }
      );
      if (!data) throw new Error('Something went wrong on user profile update');
      if (user?.role === Role.ADMIN)
        return AdminProfileInfoResponseDTO.fromEntity(data);
      return UserProfileInfoResponseDTO.fromEntity(data);
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('Unknown Error Occurred In Change Profile Info Service');
    }
  }
}
