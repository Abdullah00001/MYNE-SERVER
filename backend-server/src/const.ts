export const corsWhiteList = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://10.0.0.103:3000',
  'http://10.10.10.17:3003',
  'http://10.10.10.17:3000',
  'http://72.244.153.29:3003',
];
export const saltRound = 10;
export const emailRegex = /^[\w.-]+@[a-zA-Z\d.-]+\.[a-zA-Z]{2,}$/;
export const baseUrl = {
  v1: '/api/v1',
};
export const userAccessTokenExpiresIn = '3d';
export const adminAccessTokenExpiresIn = '15m';
export const refreshTokenExpiresInWithOutRememberMe = '3d';
export const refreshTokenExpiresInWithRememberMe = '30d';
export const otpExpireAt = 4;
export const temporaryPasswordExpireAt = 24;
export const baseCurrency = 'EUR' as const;
export const CURRENCIES = [
  'EUR',
  'USD',
  'GBP',
  'CHF',
  'JPY',
  'CAD',
  'AUD',
] as const;

export const MONTH_KEYS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
] as const;

export type MonthKey = (typeof MONTH_KEYS)[number];

export const monthNameMap: Record<string, MonthKey> = {
  Jan: 'january',
  Feb: 'february',
  Mar: 'march',
  Apr: 'april',
  May: 'may',
  Jun: 'june',
  Jul: 'july',
  Aug: 'august',
  Sep: 'september',
  Oct: 'october',
  Nov: 'november',
  Dec: 'december',
};
