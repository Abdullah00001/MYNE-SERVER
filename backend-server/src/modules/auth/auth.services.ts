import { JwtPayload } from 'jsonwebtoken';
import { generate } from 'otp-generator';
import { injectable } from 'tsyringe';

import { getRedisClient } from '@/configs/redis.config';
import { otpExpireAt } from '@/const';
import { CreateUserResponseDTO } from '@/modules/auth/auth.dto';
import User from '@/modules/auth/auth.model';
import { TSignupPayload } from '@/modules/auth/auth.schemas';
import { IUser, TVerifyOtp } from '@/modules/auth/auth.types';
import { EmailQueue } from '@/queue/queues/email.queue';
import { TSignupUserVerifyOtpEmailData } from '@/types/emailQueue.types';
import { JwtUtils } from '@/utils/jwt.utils';
import { OtpUtils } from '@/utils/otp.utils';
import { PasswordUtils } from '@/utils/password.utils';
import { SystemUtils } from '@/utils/system.utils';

@injectable()
export class AuthService {
  constructor(
    private readonly passwordUtils: PasswordUtils,
    private readonly otpUtils: OtpUtils,
    private readonly emailQueue: EmailQueue,
    private readonly systemUtils: SystemUtils,
    private readonly jwtUtils: JwtUtils
  ) {}
  async createUser(
    payload: TSignupPayload
  ): Promise<{ data: CreateUserResponseDTO; jwtToken: string }> {
    try {
      const otp = generate(6, {
        digits: true,
        lowerCaseAlphabets: false,
        specialChars: false,
        upperCaseAlphabets: false,
      });
      // hash plain otp and password
      const hashOtp = this.otpUtils.hashOtp({ otp });
      const hashPass = await this.passwordUtils.hashPassword(payload.password);
      // create a new user
      const user = new User({ ...payload, password: hashPass });
      // generate jwt token for otp page
      const jwtToken = this.jwtUtils.generateOtpPageToken({
        sub: String(user._id),
        role: user.role,
        isVerified: user.isVerified,
        accountStatus: user.accountStatus,
      });
      // trim unwanted fields
      const data = CreateUserResponseDTO.fromEntity(user);
      // email queue data
      const emailData: TSignupUserVerifyOtpEmailData = {
        email: payload.email,
        expirationTime: otpExpireAt,
        name: payload.name,
        otp,
      };
      // save the user to database
      await user.save();
      // get the redis client
      const redisClient = getRedisClient();
      const ttl = this.systemUtils.calculateMilliseconds(otpExpireAt, 'minute');
      await Promise.all([
        redisClient.set(`user:${user._id}:otp`, hashOtp, 'PX', ttl),
        this.emailQueue.sendSignupVerificationOtpEmail(emailData),
      ]);
      return { data, jwtToken };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Unknown error occurred in create user service');
    }
  }

  async verifyOtp({ user, jwt }: TVerifyOtp): Promise<{ accessToken: string }> {
    try {
      const updatedUser = await User.findByIdAndUpdate(
        user.sub,
        { $set: { isVerified: true } },
        { new: true }
      );
      if (!updatedUser) throw new Error('User not found');
      const accessToken = this.jwtUtils.generateAccessTokenForUser({
        accountStatus: updatedUser?.accountStatus,
        isVerified: updatedUser?.isVerified,
        role: updatedUser?.role,
        sub: String(updatedUser?._id),
      });
      const redisClient = getRedisClient();
      const expirationTime = user.exp as number; // convert to seconds
      const currentTime = Math.floor(Date.now() / 1000); // current time in seconds
      const ttl = Math.floor(expirationTime - currentTime); // remaining time in seconds
      if (ttl > 0)
        await redisClient.set(`blacklist:jwt:${jwt}`, jwt as string, 'EX', ttl);
      await redisClient.del(`user:${updatedUser._id}:otp`);
      await this.emailQueue.sendSignupSuccessfulEmail({
        name: updatedUser?.name,
        email: updatedUser?.email,
      });
      return { accessToken };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Unknown error occurred in verify otp service');
    }
  }

  async resendOtp({ user }: TVerifyOtp): Promise<void> {
    try {
      const otp = generate(6, {
        digits: true,
        lowerCaseAlphabets: false,
        specialChars: false,
        upperCaseAlphabets: false,
      });
      // hash plain otp and password
      const hashOtp = this.otpUtils.hashOtp({ otp });
      const foundedUser = await User.findById(user.sub);
      if (!foundedUser) throw new Error('User not found');
      const emailData: TSignupUserVerifyOtpEmailData = {
        email: foundedUser?.email,
        expirationTime: otpExpireAt,
        name: foundedUser?.name,
        otp,
      };
      const redisClient = getRedisClient();
      const ttl = this.systemUtils.calculateMilliseconds(otpExpireAt, 'minute');
      await redisClient.del(`user:${foundedUser?._id}:otp`);
      await Promise.all([
        redisClient.set(`user:${foundedUser?._id}:otp`, hashOtp, 'PX', ttl),
        this.emailQueue.sendSignupVerificationOtpEmail(emailData),
      ]);
      return;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Unknown error occurred in resend otp service');
    }
  }

  async login({
    user,
    tempPasswordFlag,
  }: {
    user: IUser;
    tempPasswordFlag: boolean;
  }): Promise<{ accessToken: string; data: CreateUserResponseDTO }> {
    try {
      const redisClient = getRedisClient();
      let data = user;
      if (tempPasswordFlag) {
        await redisClient.del(`user:${user._id}:password`);
        data = (await User.findByIdAndUpdate(
          user?._id,
          { $set: { isVerified: true } },
          { new: true }
        )) as IUser;
      }
      const accessToken = this.jwtUtils.generateAccessTokenForUser({
        accountStatus: data?.accountStatus,
        isVerified: data?.isVerified,
        role: data?.role,
        sub: String(data?._id),
        rememberMe: data?.rememberMe,
      });
      return { accessToken, data: CreateUserResponseDTO.fromEntity(data) };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Unknown error occurred in login service');
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
      const hashPassword = await this.passwordUtils.hashPassword(password);
      await User.findByIdAndUpdate(user?._id, {
        $set: { password: hashPassword },
      });
      return;
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('Unknown error occurred in password change service');
    }
  }

  async findRecoverUser({ user }: { user: IUser }): Promise<{ jwt: string }> {
    try {
      const otp = generate(6, {
        digits: true,
        lowerCaseAlphabets: false,
        specialChars: false,
        upperCaseAlphabets: false,
      });
      // hash plain otp and password
      const hashOtp = this.otpUtils.hashOtp({ otp });
      // generate jwt token for otp page
      const jwtToken = this.jwtUtils.generateOtpPageToken({
        sub: String(user._id),
        role: user.role,
        isVerified: user.isVerified,
        accountStatus: user.accountStatus,
      });
      // email queue data
      const emailData: TSignupUserVerifyOtpEmailData = {
        email: user?.email,
        expirationTime: otpExpireAt,
        name: user?.name,
        otp,
      };
      // get the redis client
      const redisClient = getRedisClient();
      const ttl = this.systemUtils.calculateMilliseconds(otpExpireAt, 'minute');
      await redisClient.del(`user:${user._id}:otp`);
      await Promise.all([
        redisClient.set(`user:${user._id}:otp`, hashOtp, 'PX', ttl),
        this.emailQueue.sendAccountRecoverVerificationOtpEmail(emailData),
      ]);
      return { jwt: jwtToken };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Unknown error occurred in find recover user service');
    }
  }

  async recoverUserVerifyOtp({ user }: TVerifyOtp): Promise<void> {
    try {
      const redisClient = getRedisClient();
      await redisClient.del(`user:${user.sub}:otp`);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Unknown error occurred in verify otp service');
    }
  }

  async recoverResetPassword({
    user,
    jwt,
    password,
  }: {
    user: JwtPayload;
    jwt: string;
    password: string;
  }): Promise<void> {
    try {
      // hash plain password
      const hashPass = await this.passwordUtils.hashPassword(password);
      const updatedUser = await User.findByIdAndUpdate(
        user?.sub,
        { $set: { password: hashPass } },
        { new: true }
      );
      const redisClient = getRedisClient();
      const expirationTime = user.exp as number;
      const currentTime = Math.floor(Date.now() / 1000); // current time in seconds
      const ttl = Math.floor(expirationTime - currentTime); // remaining time in seconds
      if (ttl > 0)
        await redisClient.set(`blacklist:jwt:${jwt}`, jwt, 'EX', ttl);
      await this.emailQueue.sendAccountRecoverSuccessfulEmail({
        name: updatedUser?.name as string,
        email: updatedUser?.email as string,
      });
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Unknown error occurred in verify otp service');
    }
  }

  async adminLogin({
    user,
    rememberMe,
  }: {
    user: IUser;
    rememberMe: boolean;
  }): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const accessToken = this.jwtUtils.generateAccessTokenForAdmin({
        sub: String(user._id),
        role: user.role,
        isVerified: user.isVerified,
        accountStatus: user.accountStatus,
        rememberMe,
      });
      const refreshToken = this.jwtUtils.generateRefreshToken({
        sub: String(user._id),
        role: user.role,
        isVerified: user.isVerified,
        accountStatus: user.accountStatus,
        rememberMe,
      });
      return { accessToken, refreshToken };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Unknown error occurred in admin login service');
    }
  }

  async logout({
    accessToken,
    user,
  }: {
    accessToken: string;
    user: JwtPayload;
  }): Promise<void> {
    try {
      const redisClient = getRedisClient();
      const expirationTime = user.exp as number;
      const currentTime = Math.floor(Date.now() / 1000); // current time in seconds
      const ttl = Math.floor(expirationTime - currentTime); // remaining time in seconds
      if (ttl > 0)
        await redisClient.set(
          `blacklist:jwt:${accessToken}`,
          accessToken,
          'EX',
          ttl
        );
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Unknown error occurred in user logout service');
    }
  }

  async adminRefreshToken({
    user,
  }: {
    user: JwtPayload;
  }): Promise<{ jwt: string }> {
    try {
      const accessToken = this.jwtUtils.generateAccessTokenForAdmin({
        sub: String(user.sub),
        role: user.role,
        isVerified: user.isVerified,
        accountStatus: user.accountStatus,
      });
      return { jwt: accessToken };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Unknown error occurred in admin refresh token service');
    }
  }

  async adminLogout({
    refreshToken,
    accessToken,
  }: {
    accessToken: string;
    refreshToken: string;
  }): Promise<void> {
    try {
      const accessTokenDecoded = this.jwtUtils.verifyAccessToken(accessToken);
      const refreshTokenDecoded = this.jwtUtils.verifyAccessToken(refreshToken);
      const redisClient = getRedisClient();
      const accessTokenExpirationTime = accessTokenDecoded?.exp as number;
      const refreshTokenExpirationTime = refreshTokenDecoded?.exp as number;
      const currentTime = Math.floor(Date.now() / 1000); // current time in seconds
      const accessTokenttl = Math.floor(
        accessTokenExpirationTime - currentTime
      );
      const refreshTokenttl = Math.floor(
        refreshTokenExpirationTime - currentTime
      );
      if (accessTokenttl > 0)
        await redisClient.set(
          `blacklist:jwt:${accessToken}`,
          accessToken,
          'EX',
          accessTokenttl
        );
      if (refreshTokenttl > 0)
        await redisClient.set(
          `blacklist:jwt:${accessToken}`,
          accessToken,
          'EX',
          refreshTokenttl
        );
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Unknown error occurred in user logout service');
    }
  }

  async recoverUserOtpResend({ user }: TVerifyOtp): Promise<void> {
    try {
      const otp = generate(6, {
        digits: true,
        lowerCaseAlphabets: false,
        specialChars: false,
        upperCaseAlphabets: false,
      });
      // hash plain otp and password
      const hashOtp = this.otpUtils.hashOtp({ otp });
      const foundedUser = await User.findById(user.sub);
      if (!foundedUser) throw new Error('User not found');
      const emailData: TSignupUserVerifyOtpEmailData = {
        email: foundedUser?.email,
        expirationTime: otpExpireAt,
        name: foundedUser?.name,
        otp,
      };
      const redisClient = getRedisClient();
      const ttl = this.systemUtils.calculateMilliseconds(otpExpireAt, 'minute');
      await redisClient.del(`user:${foundedUser?._id}:otp`);
      await Promise.all([
        redisClient.set(`user:${foundedUser?._id}:otp`, hashOtp, 'PX', ttl),
        this.emailQueue.sendAccountRecoverVerificationOtpEmail(emailData),
      ]);
      return;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        'Unknown error occurred in resend recover user otp service'
      );
    }
  }
}
