import crypto from 'crypto';

import { injectable } from 'tsyringe';

import { env } from '@/env';
import { IOtpUtils, TCompareOtpArgs, THashOtpArgs } from '@/types/otp.type';

@injectable()
export class OtpUtils implements IOtpUtils {
  private readonly secret: string;
  constructor() {
    this.secret = env.OTP_HASH_SECRET;
  }

  /**
   * Hashes a plain OTP using HMAC-SHA256.
   */
  public hashOtp({ otp }: THashOtpArgs): string {
    return crypto.createHmac('sha256', this.secret).update(otp).digest('hex');
  }

  /**
   * Timing-safe OTP comparison
   */
  public compareOtp({ hashedOtp, otp }: TCompareOtpArgs): boolean {
    const inputHashedOtp = this.hashOtp({ otp });

    const stored = Buffer.from(hashedOtp, 'hex');
    const incoming = Buffer.from(inputHashedOtp, 'hex');

    if (stored.length !== incoming.length) return false;

    return crypto.timingSafeEqual(stored, incoming);
  }
}
