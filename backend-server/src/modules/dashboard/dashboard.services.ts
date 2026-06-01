import { injectable } from 'tsyringe';

import User from '@/modules/auth/auth.model';
import {
  AppDashboardStatResult,
  PricePoint,
  TDashboardStats,
} from '@/modules/dashboard/dashboard.types';
import UserCollection from '@/modules/userBag/userBag.model';
import { TDashboardStatsQueryParamsSchema } from '@/modules/dashboard/dashboard.schemas';
import { TrendEnum } from '@/modules/adminBag/adminBag.types';
import { JwtPayload } from 'jsonwebtoken';
import { IUser } from '@/modules/auth/auth.types';
import { PublishStatus } from '@/modules/userBag/userBag.types';
@injectable()
export class DashboardService {
  async adminDashboardStat({
    query,
  }: {
    query: TDashboardStatsQueryParamsSchema;
  }): Promise<TDashboardStats> {
    try {
      const { userActivityByYear } = query;
      const targetYear = userActivityByYear ?? new Date().getFullYear();

      const [totalUsers, totalBags, bagStats, userActivity, topBrands] =
        await Promise.all([
          // 1. Total Users
          User.countDocuments({}),

          // 2. Total Bags — exclude admin-created bags
          UserCollection.countDocuments({ isAdmin: false }),

          // 3. Total Cost & Current Value (median of min+max per bag, summed)
          // Median = (currentMinValue + currentMaxValue) / 2
          UserCollection.aggregate([
            { $match: { isAdmin: false } },
            {
              $group: {
                _id: null,
                totalCost: { $sum: { $ifNull: ['$purchasePrice', 0] } },
                totalCurrentValue: {
                  $sum: {
                    $cond: {
                      if: {
                        $and: [
                          {
                            $gt: [
                              {
                                $ifNull: ['$priceStatus.currentMinValue', null],
                              },
                              null,
                            ],
                          },
                          {
                            $gt: [
                              {
                                $ifNull: ['$priceStatus.currentMaxValue', null],
                              },
                              null,
                            ],
                          },
                        ],
                      },
                      then: {
                        $divide: [
                          {
                            $add: [
                              '$priceStatus.currentMinValue',
                              '$priceStatus.currentMaxValue',
                            ],
                          },
                          2,
                        ],
                      },
                      else: 0,
                    },
                  },
                },
              },
            },
            {
              $addFields: {
                totalCost: { $round: ['$totalCost', 2] },
                totalCurrentValue: { $round: ['$totalCurrentValue', 2] },
              },
            },
          ]),

          // 4. User Activity — all 12 months of the requested year
          User.aggregate([
            {
              $match: {
                createdAt: {
                  $gte: new Date(targetYear, 0, 1),
                  $lt: new Date(targetYear + 1, 0, 1),
                },
              },
            },
            {
              $group: {
                _id: { month: { $month: '$createdAt' } },
                count: { $sum: 1 },
              },
            },
            { $sort: { '_id.month': 1 } },
            {
              $project: {
                _id: 0,
                month: '$_id.month',
                year: targetYear,
                count: 1,
              },
            },
          ]),

          // 5. Top Brands (Top 4) — exclude admin-created bags
          UserCollection.aggregate([
            { $match: { isAdmin: false } },
            {
              $lookup: {
                from: 'brands',
                localField: 'brandId',
                foreignField: '_id',
                as: 'brand',
              },
            },
            { $unwind: '$brand' },
            {
              $group: {
                _id: '$brandId',
                brandName: { $first: '$brand.brandName' },
                brandLogo: { $first: '$brand.brandLogo' },
                totalBags: { $sum: 1 },
                bagCost: { $sum: { $ifNull: ['$purchasePrice', 0] } },
                // Sum of medians: (min + max) / 2 per bag
                currentValue: {
                  $sum: {
                    $cond: {
                      if: {
                        $and: [
                          {
                            $gt: [
                              {
                                $ifNull: ['$priceStatus.currentMinValue', null],
                              },
                              null,
                            ],
                          },
                          {
                            $gt: [
                              {
                                $ifNull: ['$priceStatus.currentMaxValue', null],
                              },
                              null,
                            ],
                          },
                        ],
                      },
                      then: {
                        $divide: [
                          {
                            $add: [
                              '$priceStatus.currentMinValue',
                              '$priceStatus.currentMaxValue',
                            ],
                          },
                          2,
                        ],
                      },
                      else: 0,
                    },
                  },
                },
              },
            },
            {
              $addFields: {
                bagCost: { $round: ['$bagCost', 2] },
                currentValue: { $round: ['$currentValue', 2] },
                percentageChange: {
                  $cond: {
                    if: { $eq: ['$bagCost', 0] },
                    then: 0,
                    else: {
                      $multiply: [
                        {
                          $divide: [
                            { $subtract: ['$currentValue', '$bagCost'] },
                            '$bagCost',
                          ],
                        },
                        100,
                      ],
                    },
                  },
                },
              },
            },
            { $sort: { totalBags: -1 } },
            { $limit: 4 },
            {
              $project: {
                _id: 1,
                brandName: 1,
                brandLogo: 1,
                totalBags: 1,
                bagCost: 1,
                currentValue: 1,
                percentageChange: { $round: ['$percentageChange', 2] },
              },
            },
          ]),
        ]);

      // Fill missing months with count 0 so frontend always gets 12 data points
      const MONTH_NAMES = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
      ];

      const activityMap = new Map(userActivity.map((a) => [a.month, a.count]));

      const fullYearActivity = Array.from({ length: 12 }, (_, i) => ({
        month: MONTH_NAMES[i],
        count: activityMap.get(i + 1) ?? 0,
      }));

      const stats = bagStats[0] || { totalCost: 0, totalCurrentValue: 0 };

      return {
        success: true,
        data: {
          totalUsers,
          totalBags,
          totalCost: stats.totalCost,
          currentValue: stats.totalCurrentValue,
          userActivity: fullYearActivity,
          topBrands,
        },
      };
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error(
        'Unknown Error Occurred In Retrieve Admin Dashboard Stat Service'
      );
    }
  }

  async appDashboardStat({
    user,
    year,
  }: {
    user: IUser;
    year?: string;
  }): Promise<unknown> {
    try {
      const userId = user._id;

      // ─── Constants ─────────────────────────────────────────────────────────
      const MONTH_NAMES = [
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
      ];

      // ─── Totals + trend aggregation — only user bags (isAdmin: false) ───────
      const [summary] = await UserCollection.aggregate([
        {
          $match: {
            isArchived: false,
            isAdmin: false,
            userId,
            publishStatus: PublishStatus.PUBLISHED,
          },
        },
        {
          $group: {
            _id: null,
            totalBags: { $sum: 1 },
            totalPurchasePrice: { $sum: { $ifNull: ['$purchasePrice', 0] } },
            totalCurrentPrice: {
              $sum: {
                $cond: {
                  if: {
                    $and: [
                      {
                        $gt: [
                          { $ifNull: ['$priceStatus.currentMinValue', null] },
                          null,
                        ],
                      },
                      {
                        $gt: [
                          { $ifNull: ['$priceStatus.currentMaxValue', null] },
                          null,
                        ],
                      },
                    ],
                  },
                  then: {
                    $divide: [
                      {
                        $add: [
                          '$priceStatus.currentMinValue',
                          '$priceStatus.currentMaxValue',
                        ],
                      },
                      2,
                    ],
                  },
                  else: 0,
                },
              },
            },
            avgChangePercentage: {
              $avg: { $ifNull: ['$priceStatus.changePercentage', 0] },
            },
            upCount: {
              $sum: {
                $cond: [{ $eq: ['$priceStatus.trend', TrendEnum.UP] }, 1, 0],
              },
            },
            downCount: {
              $sum: {
                $cond: [{ $eq: ['$priceStatus.trend', TrendEnum.DOWN] }, 1, 0],
              },
            },
            stableCount: {
              $sum: {
                $cond: [
                  { $eq: ['$priceStatus.trend', TrendEnum.STABLE] },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]);

      // ─── Derive overall trend ───────────────────────────────────────────────
      const upCount: number = summary?.upCount ?? 0;
      const downCount: number = summary?.downCount ?? 0;
      const stableCount: number = summary?.stableCount ?? 0;
      const avgChangePercentage: number = parseFloat(
        (summary?.avgChangePercentage ?? 0).toFixed(2)
      );

      const deriveOverallTrend = (): TrendEnum => {
        const maxCount = Math.max(upCount, downCount, stableCount);
        if (Math.abs(avgChangePercentage) <= 1) return TrendEnum.STABLE;
        if (maxCount === upCount && avgChangePercentage > 0)
          return TrendEnum.UP;
        if (maxCount === downCount && avgChangePercentage < 0)
          return TrendEnum.DOWN;
        if (avgChangePercentage > 1) return TrendEnum.UP;
        if (avgChangePercentage < -1) return TrendEnum.DOWN;
        return TrendEnum.STABLE;
      };

      // ─── Fetch user bags that have historicalValue ──────────────────────────
      const bags = await UserCollection.find(
        {
          isArchived: false,
          isAdmin: false,
          userId, // ← scoped to this user
          historicalValue: { $ne: null },
        },
        { historicalValue: 1 }
      ).lean();

      // ─── Collect all available years across all bags ────────────────────────
      const availableYearsSet = new Set<string>();

      for (const bag of bags) {
        if (!bag.historicalValue) continue;

        const hvObj = bag.historicalValue as Record<
          string,
          Record<string, { avg_price: number | null; currency: string | null }>
        >;

        for (const yearStr of Object.keys(hvObj)) {
          if (!isNaN(parseInt(yearStr, 10))) {
            availableYearsSet.add(yearStr);
          }
        }
      }

      const availableYears = Array.from(availableYearsSet).sort(
        (a, b) => Number(a) - Number(b)
      );

      // ─── No year param → return available years only ────────────────────────
      if (!year) {
        return {
          totalBags: summary?.totalBags ?? 0,
          totalPurchasePrice: parseFloat(
            (summary?.totalPurchasePrice ?? 0).toFixed(2)
          ),
          totalCurrentPrice: parseFloat(
            (summary?.totalCurrentPrice ?? 0).toFixed(2)
          ),
          avgChangePercentage,
          overallTrend: deriveOverallTrend(),
          availableYears,
          priceHistory: null,
        };
      }

      // ─── Validate requested year ────────────────────────────────────────────
      if (!availableYears.includes(year)) {
        return {
          totalBags: summary?.totalBags ?? 0,
          totalPurchasePrice: parseFloat(
            (summary?.totalPurchasePrice ?? 0).toFixed(2)
          ),
          totalCurrentPrice: parseFloat(
            (summary?.totalCurrentPrice ?? 0).toFixed(2)
          ),
          avgChangePercentage,
          overallTrend: deriveOverallTrend(),
          availableYears,
          priceHistory: null, // year requested has no data
        };
      }

      // ─── Build 12-month price history for the requested year ────────────────
      /**
       * For each month: average the avg_price across ALL bags that have data
       * for that year+month. Months with no data return 0.
       *
       * Result shape:
       * {
       *   january: 120.50,
       *   february: 0,
       *   march: 340.00,
       *   ...
       * }
       */
      const monthlyAcc: Record<string, { sum: number; count: number }> =
        Object.fromEntries(MONTH_NAMES.map((m) => [m, { sum: 0, count: 0 }]));

      for (const bag of bags) {
        if (!bag.historicalValue) continue;

        const hvObj = bag.historicalValue as Record<
          string,
          Record<string, { avg_price: number | null; currency: string | null }>
        >;

        const yearData = hvObj[year];
        if (!yearData) continue;

        for (const month of MONTH_NAMES) {
          const avg_price = yearData[month]?.avg_price;
          if (avg_price != null) {
            monthlyAcc[month].sum += avg_price;
            monthlyAcc[month].count += 1;
          }
        }
      }

      const priceHistory: Record<string, number> = Object.fromEntries(
        MONTH_NAMES.map((month) => {
          const { sum, count } = monthlyAcc[month];
          return [month, count > 0 ? parseFloat((sum / count).toFixed(2)) : 0];
        })
      );

      return {
        totalBags: summary?.totalBags ?? 0,
        totalPurchasePrice: parseFloat(
          (summary?.totalPurchasePrice ?? 0).toFixed(2)
        ),
        totalCurrentPrice: parseFloat(
          (summary?.totalCurrentPrice ?? 0).toFixed(2)
        ),
        avgChangePercentage,
        overallTrend: deriveOverallTrend(),
        availableYears,
        priceHistory,
      };
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error(
        'Unknown Error Occurred In Retrieve App Dashboard Stat Service'
      );
    }
  }
}
