import { Request, Response, RequestHandler } from 'express';
import { JwtPayload } from 'jsonwebtoken';
import { injectable } from 'tsyringe';

import {
  adminAccessTokenExpiresIn,
  refreshTokenExpiresInWithOutRememberMe,
  refreshTokenExpiresInWithRememberMe,
} from '@/const';
import { BaseController } from '@/core/base_classes/base.controller';
import { AuthService } from '@/modules/auth/auth.services';
import { IUser } from '@/modules/auth/auth.types';
import { CookieUtils } from '@/utils/cookie.utils';
import { JwtUtils } from '@/utils/jwt.utils';

@injectable()
export class AuthController extends BaseController {
  public signup: RequestHandler;
  public verifyOtp: RequestHandler;
  public resendOtp: RequestHandler;
  public login: RequestHandler;
  public findRecoverUser: RequestHandler;
  public recoverUserOtpResend: RequestHandler;
  public recoverUserOtpVerify: RequestHandler;
  public recoverResetPassword: RequestHandler;
  public adminLogin: RequestHandler;
  public checkAccessToken: RequestHandler;
  public logout: RequestHandler;
  public checkAdminAccessToken: RequestHandler;
  public adminRefreshToken: RequestHandler;
  public adminLogout: RequestHandler;
  public changePassword: RequestHandler;

  constructor(
    private readonly authService: AuthService,
    private readonly jwtUtils: JwtUtils,
    private readonly cookieUtils: CookieUtils
  ) {
    super();
    this.signup = this.wrap(this._signup);
    this.verifyOtp = this.wrap(this._verifyOtp);
    this.resendOtp = this.wrap(this._resendOtp);
    this.login = this.wrap(this._login);
    this.findRecoverUser = this.wrap(this._findRecoverUser);
    this.recoverUserOtpVerify = this.wrap(this._recoverUserOtpVerify);
    this.recoverResetPassword = this.wrap(this._recoverResetPassword);
    this.adminLogin = this.wrap(this._adminLogin);
    this.checkAccessToken = this.wrap(this._checkAccessToken);
    this.logout = this.wrap(this._logout);
    this.checkAdminAccessToken = this.wrap(this._checkAdminAccessToken);
    this.adminRefreshToken = this.wrap(this._adminRefreshToken);
    this.adminLogout = this.wrap(this._adminLogout);
    this.recoverUserOtpResend = this.wrap(this._recoverUserOtpResend);
    this.changePassword = this.wrap(this._changePassword);
  }

  private async _signup(req: Request, res: Response): Promise<void> {
    const data = await this.authService.createUser(req.body);
    res.status(200).json({ success: true, message: 'Signup successful', data });
    return;
  }

  private async _verifyOtp(req: Request, res: Response): Promise<void> {
    const jwt = this.jwtUtils.extractToken(req);
    const { accessToken } = await this.authService.verifyOtp({
      user: req.user,
      jwt: jwt as string,
    });
    res.status(200).json({
      success: true,
      message: 'otp verification successful',
      accessToken,
    });
    return;
  }

  private async _resendOtp(req: Request, res: Response): Promise<void> {
    await this.authService.resendOtp({ user: req.user });
    res.status(200).json({
      success: true,
      message: 'otp resend successful',
    });
    return;
  }

  private async _login(req: Request, res: Response): Promise<void> {
    const tempPasswordFlag = req.isTempPasswordMatched;
    const { accessToken, data } = await this.authService.login({
      user: req.user as IUser,
      tempPasswordFlag,
    });
    res.status(200).json({
      success: true,
      message: 'login successful',
      data,
      accessToken,
      passwordChangeRequired: tempPasswordFlag,
    });
    return;
  }

  private async _changePassword(req: Request, res: Response):Promise<void>  {
    const user=req.user as IUser;
    const {password}=req.body;
    await this.authService.changePassword({ password, user });
    res.status(200).json({
      status: 200,
      success: true,
      message: 'Password change successful',
    });
    return;
  }

  private async _findRecoverUser(req: Request, res: Response): Promise<void> {
    const { jwt } = await this.authService.findRecoverUser({
      user: req.user as IUser,
    });
    res.status(200).json({
      status:200,
      success: true,
      message: 'User found',
      data: {
        jwtToken: jwt,
      },
    });
    return;
  }

  private async _recoverUserOtpVerify(
    req: Request,
    res: Response
  ): Promise<void> {
    await this.authService.recoverUserVerifyOtp({ user: req.user });
    res.status(200).json({
      success: true,
      message: 'Otp verification successful',
    });
    return;
  }

  private async _recoverResetPassword(
    req: Request,
    res: Response
  ): Promise<void> {
    const { password } = req.body;
    const jwt = this.jwtUtils.extractToken(req);
    await this.authService.recoverResetPassword({
      jwt: jwt as string,
      password,
      user: req.user,
    });
    res.status(200).json({
      success: true,
      message: 'password reset successful',
    });
    return;
  }

  private async _checkAccessToken(_req: Request, res: Response): Promise<void> {
    res.status(200).json({ success: true, message: 'User Authenticated' });
    return;
  }

  private async _logout(req: Request, res: Response): Promise<void> {
    const user = req.user;
    const accessToken = this.jwtUtils.extractToken(req);
    await this.authService.logout({ accessToken: accessToken as string, user });
    res.status(200).json({ success: true, message: 'User logout successful' });
    return;
  }

  /**
   * ==========================================
   * ------------ADMIN AUTH ROUTES-------------
   * ===========================================
   */
  private async _adminLogin(req: Request, res: Response): Promise<void> {
    const { rememberMe } = req.body;
    const { accessToken, refreshToken } = await this.authService.adminLogin({
      user: req.user as IUser,
      rememberMe,
    });
    const refreshTokenExpireIn = rememberMe
      ? refreshTokenExpiresInWithRememberMe
      : refreshTokenExpiresInWithOutRememberMe;
    res.cookie(
      'accesstoken',
      accessToken,
      this.cookieUtils.cookieOption(adminAccessTokenExpiresIn)
    );
    res.cookie(
      'refreshtoken',
      refreshToken,
      this.cookieUtils.cookieOption(refreshTokenExpireIn)
    );
    res
      .status(200)
      .json({ success: true, status: 200, message: 'Admin login successful' });
    return;
  }

  private async _checkAdminAccessToken(
    _req: Request,
    res: Response
  ): Promise<void> {
    res.status(200).json({ success: true, message: 'User Authenticated' });
    return;
  }

  private async _adminRefreshToken(req: Request, res: Response): Promise<void> {
    const user = req.user as JwtPayload;
    const { jwt } = await this.authService.adminRefreshToken({ user });
    res.cookie(
      'accesstoken',
      jwt,
      this.cookieUtils.cookieOption(adminAccessTokenExpiresIn)
    );
    res
      .status(200)
      .json({ success: true, message: 'Token refresh successful' });
    return;
  }

  private async _adminLogout(req: Request, res: Response): Promise<void> {
    const { accesstoken, refreshtoken } = req.cookies;
    await this.authService.adminLogout({
      accessToken: accesstoken as string,
      refreshToken: refreshtoken,
    });
    res.clearCookie('accesstoken');
    res.clearCookie('refreshtoken');
    res.status(200).json({ success: true, message: 'Admin logout successful' });
    return;
  }

  private async _recoverUserOtpResend(
    req: Request,
    res: Response
  ): Promise<void> {
    const user = req.user as JwtPayload;
    await this.authService.recoverUserOtpResend({ user });
    res.status(200).json({ success: true, message: 'Otp resend successful' });
    return;
  }
}
