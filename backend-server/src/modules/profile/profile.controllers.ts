import { Request, Response, RequestHandler } from 'express';
import { injectable } from 'tsyringe';

import { BaseController } from '@/core/base_classes/base.controller';
import { IUser } from '@/modules/auth/auth.types';
import {
  AdminProfileInfoResponseDTO,
  UserProfileInfoResponseDTO,
} from '@/modules/profile/profile.dto';
import { TUpdateUserProfileInfo } from '@/modules/profile/profile.schemas';
import { ProfileService } from '@/modules/profile/profile.services';
import { Role } from '@/types/jwt.types';

@injectable()
export class ProfileController extends BaseController {
  public uploadAvatar: RequestHandler;
  public deleteAvatar: RequestHandler;
  public changePassword: RequestHandler;
  public changeProfileInfo: RequestHandler;
  public getProfileInfo: RequestHandler;

  constructor(private readonly profileService: ProfileService) {
    super();
    this.uploadAvatar = this.wrap(this._uploadAvatar);
    this.deleteAvatar = this.wrap(this.__deleteAvatar);
    this.changePassword = this.wrap(this.__changePassword);
    this.changeProfileInfo = this.wrap(this.__changeProfileInfo);
    this.getProfileInfo = this.wrap(this.__getProfileInfo);
  }

  private async _uploadAvatar(req: Request, res: Response): Promise<void> {
    const fileName = req?.file?.filename as string;
    const mimeType = req?.file?.mimetype as string;
    const user = req.user as IUser;
    const data = await this.profileService.uploadAvatar({
      fileName,
      user,
      mimeType,
    });

    res
      .status(200)
      .json({ success: true, message: 'Avatar upload successful', data });
    return;
  }

  private async __deleteAvatar(req: Request, res: Response): Promise<void> {
    const user = req.user as IUser;
    await this.profileService.deleteAvatar({ user });
    res
      .status(200)
      .json({ success: true, message: 'Avatar delete successful' });
    return;
  }

  private async __changePassword(req: Request, res: Response): Promise<void> {
    const { newPassword } = req.body;
    const user = req.user as IUser;
    await this.profileService.changePassword({ password: newPassword, user });
    res
      .status(200)
      .json({ success: true, message: 'Password change successful' });
    return;
  }

  private async __changeProfileInfo(
    req: Request,
    res: Response
  ): Promise<void> {
    const userData = req.body as TUpdateUserProfileInfo;
    const user = req.user as IUser;
    const data = await this.profileService.changeUserProfileInfo({
      user,
      userData,
    });
    res
      .status(200)
      .json({ success: true, message: 'Profile info change successful', data });
    return;
  }

  private async __getProfileInfo(req: Request, res: Response): Promise<void> {
    const user = req.user as IUser;
    let data: TUpdateUserProfileInfo | null = null;
    if (user?.role === Role.ADMIN)
      data = AdminProfileInfoResponseDTO.fromEntity(user);
    else data = UserProfileInfoResponseDTO.fromEntity(user);
    res
      .status(200)
      .json({ success: true, message: 'Profile info retrieve successful', data });
    return;
  }
}
