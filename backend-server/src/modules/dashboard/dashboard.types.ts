import { TrendEnum } from "@/modules/adminBag/adminBag.types";

export type TUserActivity = {
  month: string;
  count: number;
};

export type TTopBrand = {
  _id: string;
  brandName: string;
  brandLogo: string | null;
  totalBags: number;
  bagCost: number;
  currentValue: number;
  percentageChange: number;
};

export type TDashboardData = {
  totalUsers: number;
  totalBags: number;
  totalCost: number;
  currentValue: number;
  userActivity: TUserActivity[];
  topBrands: TTopBrand[];
};

export type TDashboardStats = {
  success: boolean;
  data: TDashboardData;
};

export interface PricePoint {
  date: string;
  avgPrice: number;
  currency: string;
}

export interface AppDashboardStatResult {
  totalBags: number;
  totalPurchasePrice: number;
  totalCurrentPrice: number;
  avgChangePercentage: number;
  overallTrend: TrendEnum;
  priceHistory: {
    last10Days: number;
    last1Month: number;
    last6Months: number;
    last1Year: number;
  };
}