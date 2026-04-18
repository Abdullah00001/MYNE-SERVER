// utils/system.utils.ts

import crypto from 'crypto';
import { unlink } from 'fs/promises';

import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { injectable } from 'tsyringe';

import { CURRENCIES, MONTH_KEYS, MonthKey } from '@/const';
import { IMonthValue, IYearValue } from '@/modules/userBag/userBag.types';

dayjs.extend(utc);
dayjs.extend(timezone);

type Currency = (typeof CURRENCIES)[number];

@injectable()
export class SystemUtils {
  /* ------------------------------------------------------------------
   * PRICE CALCULATIONS
   * ------------------------------------------------------------------ */

  /**
   * Get the number of decimal places (minor units) for a currency
   * Most currencies use 2 decimal places, but some like JPY use 0
   */
  private getCurrencyMinorUnits(currency: Currency): number {
    const zeroDecimalCurrencies: Currency[] = ['JPY'];
    return zeroDecimalCurrencies.includes(currency) ? 0 : 2;
  }

  /**
   * Convert major unit price to minor units (cents, pence, etc.)
   * @param amount - Price in major units (e.g., 99.99 EUR)
   * @param currency - Currency code
   * @returns Price in minor units (e.g., 9999 cents)
   *
   * @example
   * toMinorUnits(99.99, 'EUR') // Returns 9999
   * toMinorUnits(1000, 'JPY')  // Returns 1000 (JPY has no minor units)
   */
  toMinorUnits(amount: number, currency: Currency): number {
    const minorUnits = this.getCurrencyMinorUnits(currency);
    return Math.round(amount * Math.pow(10, minorUnits));
  }

  /**
   * Convert minor unit price to major units (dollars, euros, etc.)
   * @param amount - Price in minor units (e.g., 9999 cents)
   * @param currency - Currency code
   * @returns Price in major units (e.g., 99.99 EUR)
   *
   * @example
   * toMajorUnits(9999, 'EUR') // Returns 99.99
   * toMajorUnits(1000, 'JPY')  // Returns 1000 (JPY has no minor units)
   */
  toMajorUnits(amount: number, currency: Currency): number {
    const minorUnits = this.getCurrencyMinorUnits(currency);
    return amount / Math.pow(10, minorUnits);
  }

  /**
   * Format price with currency symbol and proper decimals
   * @param amount - Price in major units
   * @param currency - Currency code
   * @returns Formatted price string
   *
   * @example
   * formatPrice(1234.56, 'EUR') // Returns "€1,234.56"
   * formatPrice(1000, 'JPY')    // Returns "¥1,000"
   * formatPrice(99.99, 'USD')   // Returns "$99.99"
   */
  formatPrice(amount: number, currency: Currency): string {
    const minorUnits = this.getCurrencyMinorUnits(currency);

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: minorUnits,
      maximumFractionDigits: minorUnits,
    }).format(amount);
  }

  /* ------------------------------------------------------------------
   * TIME & CALCULATION
   * ------------------------------------------------------------------ */

  calculateMilliseconds(value: number, unit: string): number {
    switch (unit.toLowerCase()) {
      case 'millisecond':
      case 'milliseconds':
        return value;
      case 'second':
      case 'seconds':
        return value * 1000;
      case 'minute':
      case 'minutes':
        return value * 60 * 1000;
      case 'hour':
      case 'hours':
        return value * 60 * 60 * 1000;
      case 'day':
      case 'days':
        return value * 24 * 60 * 60 * 1000;
      default:
        return NaN;
    }
  }

  stringToNumber(value: string): number {
    return Number(value.slice(0, -1));
  }

  expiresInTimeUnitToMs(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)(ms|s|m|h|d)$/);
    if (!match) throw new Error('Invalid expiresIn format');

    const value = Number(match[1]);
    const unit = match[2];

    const map: Record<string, number> = {
      ms: 1,
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return value * map[unit];
  }

  /* ------------------------------------------------------------------
   * ETAG
   * ------------------------------------------------------------------ */

  generateEtag(data: unknown): string {
    try {
      const dataString = JSON.stringify(data);
      return crypto.createHash('md5').update(dataString).digest('hex');
    } catch (error) {
      throw new Error(
        `Failed to generate ETag: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /* ------------------------------------------------------------------
   * DATE
   * ------------------------------------------------------------------ */

  formatDate(isoDateString: string): string {
    const date = new Date(isoDateString);
    if (isNaN(date.getTime())) throw new Error('Invalid date string');

    return dayjs(date).format('D MMMM YYYY');
  }

  formatDateTime(isoString: string, timeZone = 'Asia/Dhaka'): string {
    return dayjs(isoString)
      .tz(timeZone)
      .format('MMMM D, YYYY [at] hh:mm A (z)');
  }

  calculateFutureDate(duration: string): string {
    const ms = this.expiresInTimeUnitToMs(duration);
    return new Date(Date.now() + ms).toISOString();
  }

  compareDate(oldDate: Date, duration: string): boolean {
    const ms = this.expiresInTimeUnitToMs(duration);
    return Date.now() - new Date(oldDate).getTime() >= ms;
  }

  /* ------------------------------------------------------------------
   * FILE OPERATIONS
   * ------------------------------------------------------------------ */

  async unlinkFile({ filePath }: { filePath: string }): Promise<void> {
    try {
      await unlink(filePath);
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('Unknown Error Occurred In File Unlink Utility');
    }
  }

  extractS3KeyFromUrl(url: string): string {
    // Extract key from URL: https://bucket.s3.region.amazonaws.com/avatars/userId/timestamp.png
    const urlParts = url.split('.amazonaws.com/');
    return urlParts[1];
  }

  generateTemporaryPassword(length = 16): string {
    if (length < 4) throw new Error('length must be >= 4');

    const LOWER = 'abcdefghijklmnopqrstuvwxyz';
    const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const NUM = '0123456789';
    const SYM = '!@#$%^&*()_+-=[]{}<>?';

    const ALL = LOWER + UPPER + NUM + SYM;

    const rand = (chars: string) => chars[crypto.randomInt(0, chars.length)];

    // ensure at least one from each group
    const chars = [rand(LOWER), rand(UPPER), rand(NUM), rand(SYM)];

    // fill remaining length
    for (let i = chars.length; i < length; i++) {
      chars.push(rand(ALL));
    }

    // Fisher–Yates shuffle (crypto)
    for (let i = chars.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }

    return chars.join('');
  }

  createEmptyMonthValue(): IMonthValue {
    return {
      currency: null,
      avg_price: null,
    };
  }

  createEmptyYear(): IYearValue {
    const year = {} as Record<MonthKey, IMonthValue>;

    for (const month of MONTH_KEYS) {
      year[month] = this.createEmptyMonthValue();
    }

    return year as IYearValue;
  }

  extractHistoricalYears(
    historicalValue?: Record<string, IYearValue> | Map<string, IYearValue>
  ): string[] {
    if (!historicalValue) return [];

    let years: string[];

    if (historicalValue instanceof Map) {
      years = Array.from(historicalValue.keys());
    } else {
      years = Object.keys(historicalValue);
    }

    return years.sort((a, b) => Number(b) - Number(a));
  }
}
