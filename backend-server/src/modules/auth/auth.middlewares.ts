import { Request, Response, NextFunction, RequestHandler } from 'express';
import { JwtPayload } from 'jsonwebtoken';
import { injectable } from 'tsyringe';

import { getRedisClient } from '@/configs/redis.config';
import { BaseMiddleware } from '@/core/base_classes/base.middleware';
import User from '@/modules/auth/auth.model';
import { AccountStatus, IUser, AuthErrorType } from '@/modules/auth/auth.types';
import { Role } from '@/types/jwt.types';
import { JwtUtils } from '@/utils/jwt.utils';
import { OtpUtils } from '@/utils/otp.utils';
import { PasswordUtils } from '@/utils/password.utils';

@injectable()
export class AuthMiddleware extends BaseMiddleware {
  public checkSignupUserExist: RequestHandler;
  public checkOtpPageToken: RequestHandler;
  public checkOtp: RequestHandler;
  public findUserWithEmail: RequestHandler;
  public checkPassword: RequestHandler;
  public checkAccessToken: RequestHandler;
  public checkAdminAccessToken: RequestHandler;
  public checkAdminRefreshToken: RequestHandler;
  public checkUserAccountStatus: RequestHandler;
  constructor(
    private readonly jwtUtils: JwtUtils,
    private readonly otpUtils: OtpUtils,
    private readonly passwordUtils: PasswordUtils
  ) {
    super();
    this.checkSignupUserExist = this.wrap(this._checkSignupUserExist);
    this.checkOtpPageToken = this.wrap(this._checkOtpPageToken);
    this.checkOtp = this.wrap(this._checkOtp);
    this.findUserWithEmail = this.wrap(this._findUserWithEmail);
    this.checkPassword = this.wrap(this._checkPassword);
    this.checkAccessToken = this.wrap(this._checkAccessToken);
    this.checkAdminAccessToken = this.wrap(this._checkAdminAccessToken);
    this.checkAdminRefreshToken = this.wrap(this._checkAdminRefreshToken);
    this.checkUserAccountStatus = this.wrap(this._checkUserAccountStatus);
  }

  private async _checkSignupUserExist(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { email } = req.body;
    const user = await User.findOne({ email }).lean();
    if (user) {
      res.status(409).json({
        success: false,
        message: 'User with this email already exist',
      });
      return;
    }
    next();
  }
  private async _checkOtpPageToken(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const token = this.jwtUtils.extractToken(req);
    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Authentication token not found',
        errorType: AuthErrorType.TOKEN_INVALID,
      });
      return;
    }
    const redisClient = getRedisClient();
    const isBlackListed = await redisClient.get(`blacklist:jwt:${token}`);
    if (isBlackListed) {
      res.status(401).json({
        success: false,
        message: 'Token has been revoked',
        errorType: AuthErrorType.TOKEN_BLACKLISTED,
      });
      return;
    }
    const decoded = this.jwtUtils.verifyOtpPageToken(token);
    if (!decoded) {
      res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
        errorType: AuthErrorType.TOKEN_INVALID,
      });
      return;
    }
    req.user = decoded;
    next();
  }

  private async _checkOtp(req: Request, res: Response, next: NextFunction) {
    const user = req.user as JwtPayload;
    const { otp } = req.body;
    // get the redis client
    const redisClient = getRedisClient();
    const hashedOtp = await redisClient.get(`user:${user.sub}:otp`);
    if (!hashedOtp) {
      res.status(401).json({
        success: false,
        message: 'OTP has expired, please request a new one',
      });
      return;
    }
    const isMatched = this.otpUtils.compareOtp({ hashedOtp, otp });
    if (!isMatched) {
      res.status(401).json({
        success: false,
        message: 'Invalid OTP, please check and try again',
      });
      return;
    }
    next();
  }

  private async _findUserWithEmail(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const route = req.path;
    const isAdminRoute = route.startsWith('/auth/admin');
    const { email, rememberMe } = req.body;
    const user = await User.findOne({ email }).lean();

    // Check if user exists first
    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Invalid Credential, Check Your Email And Password',
      });
      return;
    }

    // Check admin route permissions
    if (isAdminRoute && user.role === Role.USER) {
      res.status(403).json({
        success: false,
        message: 'Access denied, admin privileges required',
      });
      return;
    }

    // Apply verification checks for non-admin routes
    if (!isAdminRoute) {
      if (!user.isVerified) {
        if (user.password !== null) {
          res.status(401).json({
            success: false,
            message:
              'Account not verified, please verify your email address first',
          });
          return;
        }
      }
      if (user.accountStatus === AccountStatus.BLOCKED) {
        res.status(401).json({
          success: false,
          message:
            'Your account has been blocked, please contact support for assistance',
          errorType: AuthErrorType.USER_BLOCKED,
        });
        return;
      }
    }

    const userWithRememberMe = { ...user, rememberMe };
    req.user = userWithRememberMe;
    next();
  }

  private async _checkPassword(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const requestPassword = req.body?.password;
    const redisClient = getRedisClient();
    const isTempPasswordExist = await redisClient.get(
      `user:${(req?.user as IUser)._id}:password`
    );
    if (!isTempPasswordExist && !(req?.user as IUser).password) {
      res.status(401).json({
        success: false,
        message:
          'Your temporary password has expired. Please use Forgot Password to access your account.',
      });
      return;
    }
    if (isTempPasswordExist) {
      const isMatched = await this.passwordUtils.comparePassword(
        requestPassword,
        isTempPasswordExist
      );
      if (!isMatched) {
        res.status(401).json({
          success: false,
          message: 'Invalid Credential,Check Your Email And Password',
        });
        return;
      }
      req.isTempPasswordMatched = true;
      next();
      return;
    }
    const password = (req?.user as IUser).password;
    const isMatched = await this.passwordUtils.comparePassword(
      requestPassword,
      password
    );
    if (!isMatched) {
      res.status(401).json({
        success: false,
        message: 'Invalid Credential,Check Your Email And Password',
      });
      return;
    }
    req.isTempPasswordMatched = false;
    next();
    return;
  }

  private async _checkAccessToken(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const token = this.jwtUtils.extractToken(req);
    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Authentication token not found',
        errorType: AuthErrorType.TOKEN_INVALID,
      });
      return;
    }
    const redisClient = getRedisClient();
    const isBlackListed = await redisClient.get(`blacklist:jwt:${token}`);
    if (isBlackListed) {
      res.status(401).json({
        success: false,
        message: 'Token has been revoked',
        errorType: AuthErrorType.TOKEN_BLACKLISTED,
      });
      return;
    }
    const decoded = this.jwtUtils.verifyAccessToken(token);
    if (!decoded) {
      res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
        errorType: AuthErrorType.TOKEN_INVALID,
      });
      return;
    }
    req.user = decoded;
    next();
  }

  private async _checkAdminAccessToken(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const token = req?.cookies?.accesstoken;
    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized request, authentication required',
        errorType: AuthErrorType.TOKEN_INVALID,
      });
      return;
    }
    const redisClient = getRedisClient();
    const isBlackListed = await redisClient.get(`blacklist:jwt:${token}`);
    if (isBlackListed) {
      res.status(401).json({
        success: false,
        message: 'Token has been revoked',
        errorType: AuthErrorType.TOKEN_BLACKLISTED,
      });
      return;
    }
    const decoded = this.jwtUtils.verifyAccessToken(token);
    if (!decoded) {
      res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
        errorType: AuthErrorType.TOKEN_INVALID,
      });
      return;
    }
    req.user = decoded;
    next();
  }

  private async _checkAdminRefreshToken(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const token = req?.cookies?.refreshtoken;
    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized request, refresh token required',
        errorType: AuthErrorType.TOKEN_INVALID,
      });
      return;
    }
    const redisClient = getRedisClient();
    const isBlackListed = await redisClient.get(`blacklist:jwt:${token}`);
    if (isBlackListed) {
      res.status(401).json({
        success: false,
        message: 'Token has been revoked',
        errorType: AuthErrorType.TOKEN_BLACKLISTED,
      });
      return;
    }
    const decoded = this.jwtUtils.verifyRefreshToken(token);
    if (!decoded) {
      res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token',
        errorType: AuthErrorType.TOKEN_INVALID,
      });
      return;
    }
    req.user = decoded;
    next();
  }

  private async _checkUserAccountStatus(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const route = req.path;
    const { sub } = req.user as JwtPayload;
    const user = await User.findById(sub);
    if (user?.accountStatus === AccountStatus.BLOCKED) {
      res.status(401).json({
        success: false,
        message: 'Access denied, your account has been blocked',
        errorType: AuthErrorType.USER_BLOCKED,
      });
      return;
    }
    const isLogoutRoute = route.startsWith('/auth/logout');
    if (!isLogoutRoute) req.user = user as IUser;
    next();
  }
}
