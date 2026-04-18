/**
 * THashOtpArgs Is For What Argument Will Be Accept In Hashing Otp Method
 * @property otp - The plain OTP string to be hashed.
 */

export type THashOtpArgs = {
  otp: string;
};

/**
 * TCompareOtpArgs Is For What Argument Will Be Accept In Compare Otp Method
 * @property otp - The plain OTP string provided by the user.
 * @property hashedOtp - The hashed OTP to compare against.
 */

export type TCompareOtpArgs = {
  otp: string;
  hashedOtp: string;
};

/**
 * Contract for OTP utility classes.
 * Ensures implementing classes provide methods for hashing and comparing OTPs.
 */

export interface IOtpUtils {
  /**
   * Hashes a plain OTP using HMAC-SHA256.
   * @param kwargs - The OTP arguments.
   * @returns The hashed OTP as a hexadecimal string.
   */

  hashOtp(kwargs: THashOtpArgs): string;

  /**
   * Compares a plain OTP with a stored hash in a timing-safe manner.
   * @param kwargs - The OTP and stored hash arguments.
   * @returns True if the OTP matches the hash, false otherwise.
   */

  compareOtp(kwargs: TCompareOtpArgs): boolean;
}
