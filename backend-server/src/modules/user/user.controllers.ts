import { Request, Response, RequestHandler } from 'express';
import { injectable } from 'tsyringe';

import { BaseController } from '@/core/base_classes/base.controller';
import { GetSingleUserResponseDTO } from '@/modules/user/user.dto';
import { GetUsersQueryParams, TCreateUser } from '@/modules/user/user.schemas';
import { UserService } from '@/modules/user/user.services';

@injectable()
export class UserController extends BaseController {
  public getUsers: RequestHandler;
  public getSingleUser: RequestHandler;
  public changeUserAccountStatus: RequestHandler;
  public createUser: RequestHandler;

  constructor(private readonly userService: UserService) {
    super();
    this.getUsers = this.wrap(this._getUsers);
    this.createUser = this.wrap(this._createUser);
    this.getSingleUser = this.wrap(this._getSingleUser);
    this.changeUserAccountStatus = this.wrap(this._changeUserAccountStatus);
  }

  private async _createUser(req: Request, res: Response): Promise<void> {
    const payload = req.body as TCreateUser;
    await this.userService.createUser({ payload });
    res.status(201).json({
      success: true,
      status: 201,
      message:
        'User Creation And Temporary Password Sent To User Email Operation Successful',
    });
    return;
  }

  private async _getUsers(req: Request, res: Response): Promise<void> {
    const query = req?.validatedQuery as GetUsersQueryParams;
    const data = await this.userService.getUsers({ params: query });
    res.status(200).json({
      success: true,
      status: 200,
      message: 'User Retrieve Successful',
      ...data,
    });
    return;
  }

  private async _getSingleUser(req: Request, res: Response): Promise<void> {
    const user = req.getUser;
    const data = GetSingleUserResponseDTO.fromEntity(user);
    res.status(200).json({
      success: true,
      status: 200,
      message: 'User Retrieve Successful',
      data,
    });
    return;
  }

  private async _changeUserAccountStatus(
    req: Request,
    res: Response
  ): Promise<void> {
    const { accountStatus } = req.body;
    const user = req.getUser;
    const data = await this.userService.changeUserAccountStatus({
      accountStatus,
      userId: user._id,
    });
    res.status(200).json({
      success: true,
      status: 200,
      message: 'User Account Status Change Successful',
      data,
    });
    return;
  }
}
