import { injectable } from 'tsyringe';

import { env } from '@/env';
import TCookieOptions from '@/types/cookie.type';

@injectable()
export class CookieUtils {
  private readonly isProd = env.NODE_ENV === 'production';

  cookieOption(expiresIn: string): TCookieOptions {
    const option: TCookieOptions = {
      httpOnly: true,
      secure: this.isProd,
      sameSite: this.isProd ? 'lax' : 'lax',
      path: '/',
    };

    option.maxAge = this.parseExpiresIn(expiresIn);

    return option;
  }

  sharedCookieOption(): TCookieOptions {
    return {
      httpOnly: false,
      secure: this.isProd,
      sameSite: this.isProd ? 'none' : 'lax',
      path: '/',
      maxAge: 1 * 24 * 60 * 60 * 1000,
    };
  }

  /**
   * Parses time strings like: 500ms | 10s | 5m | 2h | 7d
   */
  private parseExpiresIn(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)(ms|s|m|h|d)$/);

    if (!match) {
      throw new Error(`Invalid expiresIn format: ${expiresIn}`);
    }

    const value = Number(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'ms':
        return value;
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        throw new Error(`Unsupported time unit: ${unit}`);
    }
  }
}
