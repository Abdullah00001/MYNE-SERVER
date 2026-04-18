import { type Request } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { injectable } from 'tsyringe';

import logger from '@/configs/logger.config';
import {
  refreshTokenExpiresInWithOutRememberMe,
  refreshTokenExpiresInWithRememberMe,
} from '@/const';
import { env } from '@/env';
import { ITokenPayload } from '@/types/jwt.types';

@injectable()
export class JwtUtils {
  generateAccessTokenForUser(payload: ITokenPayload | null): string {
    if (!payload) {
      throw new Error('Generate AccessToken Payload Cant Be Null');
    }

    const expiresAt = payload.rememberMe === true ? '30d' : '3d';

    return jwt.sign(payload, env.JWT_ACCESS_TOKEN_SECRET_KEY as string, {
      expiresIn: expiresAt,
    });
  }

  generateAccessTokenForAdmin(payload: ITokenPayload | null): string {
    if (!payload) {
      throw new Error('Generate AccessToken Payload Cant Be Null');
    }

    return jwt.sign(payload, env.JWT_ACCESS_TOKEN_SECRET_KEY as string, {
      expiresIn: '15m',
    });
  }

  generateRefreshToken(payload: ITokenPayload): string {
    if (!payload) {
      throw new Error('Generate RefreshToken Payload Cant Be Null');
    }

    const expiresAt =
      payload.rememberMe === true
        ? refreshTokenExpiresInWithRememberMe
        : refreshTokenExpiresInWithOutRememberMe;

    return jwt.sign(payload, env.JWT_REFRESH_TOKEN_SECRET_KEY, {
      expiresIn: expiresAt,
    });
  }

  generateOtpPageToken(payload: ITokenPayload | null): string {
    if (!payload) {
      throw new Error('Generate Otp Page Token Payload Cant Be Null');
    }

    return jwt.sign(payload, env.JWT_VERIFY_OTP_PAGE_SECRET_KEY as string, {
      expiresIn: '1d',
    });
  }

  verifyOtpPageToken(token: string | null): JwtPayload | null {
    if (!token) {
      throw new Error('Otp Page Token Is Missing');
    }

    try {
      return jwt.verify(
        token,
        env.JWT_VERIFY_OTP_PAGE_SECRET_KEY
      ) as JwtPayload;
    } catch (error) {
      logger.error(error);
      return null;
    }
  }

  verifyAccessToken(token: string | null): JwtPayload | null {
    if (!token) {
      throw new Error('Access Token Is Missing');
    }

    try {
      return jwt.verify(token, env.JWT_ACCESS_TOKEN_SECRET_KEY) as JwtPayload;
    } catch (error) {
      logger.error(error);
      return null;
    }
  }

  verifyRefreshToken(token: string): JwtPayload | null {
    if (!token) {
      throw new Error('Refresh Token Is Missing');
    }

    try {
      return jwt.verify(token, env.JWT_REFRESH_TOKEN_SECRET_KEY) as JwtPayload;
    } catch (error) {
      logger.error(error);
      return null;
    }
  }

  extractToken(req: Request): string | null {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split(' ');

    // Validate format: "Bearer <token>"
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1];
  }
}
