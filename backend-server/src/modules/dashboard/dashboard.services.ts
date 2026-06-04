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
    period,
  }: {
    user: IUser;
    period?: string;
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

      const STATIC_PERIODS = ['3 months', '6 months', '1 year'] as const;

      const periodToMonthCount: Record<string, number> = {
        '3 months': 3,
        '6 months': 6,
        '1 year': 12,
      };

      // ─── End point = current month - 1 ─────────────────────────────────────
      const now = new Date();
      const currentYear = now.getFullYear();
      const endDate = new Date(currentYear, now.getMonth() - 1, 1);
      const endYear = endDate.getFullYear();
      const endMonth = endDate.getMonth(); // 0-based

      // ─── Helper: build month slice ──────────────────────────────────────────
      const buildMonthSlice = (
        count: number
      ): { year: number; month: number }[] => {
        const slice: { year: number; month: number }[] = [];
        for (let i = count - 1; i >= 0; i--) {
          const date = new Date(endYear, endMonth - i, 1);
          slice.push({ year: date.getFullYear(), month: date.getMonth() });
        }
        return slice;
      };

      // ─── Totals + trend aggregation ─────────────────────────────────────────
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
          userId,
          historicalValue: { $ne: null },
        },
        { historicalValue: 1 }
      ).lean();

      // ─── Build available periods for frontend picker ────────────────────────
      const yearsInDbSet = new Set<number>();
      for (const bag of bags) {
        if (!bag.historicalValue) continue;
        const hvObj = bag.historicalValue as Record<string, unknown>;
        for (const key of Object.keys(hvObj)) {
          const y = parseInt(key, 10);
          if (!isNaN(y) && y < currentYear) {
            yearsInDbSet.add(y);
          }
        }
      }

      const oldYears = Array.from(yearsInDbSet)
        .sort((a, b) => b - a) // descending
        .map(String);

      const availablePeriods: string[] = [...STATIC_PERIODS, ...oldYears];

      // ─── Resolve period — default to "1 year" ──────────────────────────────
      const resolvedPeriod = period ?? '1 year';
      const isStaticPeriod = STATIC_PERIODS.includes(
        resolvedPeriod as (typeof STATIC_PERIODS)[number]
      );
      const isOldYearPeriod = !isStaticPeriod && /^\d{4}$/.test(resolvedPeriod);

      // ─── Build priceHistory ─────────────────────────────────────────────────
      type MonthlyAcc = Record<
        string,
        Record<string, { sum: number; count: number }>
      >;

      let priceHistory: Record<string, Record<string, number>> | null = null;

      if (isStaticPeriod) {
        const slice = buildMonthSlice(periodToMonthCount[resolvedPeriod]);

        // Initialize accumulator grouped by year → month
        const acc: MonthlyAcc = {};
        for (const { year, month } of slice) {
          const yearKey = year.toString();
          const monthKey = MONTH_NAMES[month];
          if (!acc[yearKey]) acc[yearKey] = {};
          acc[yearKey][monthKey] = { sum: 0, count: 0 };
        }

        // Accumulate avg_price across all bags
        for (const bag of bags) {
          if (!bag.historicalValue) continue;
          const hvObj = bag.historicalValue as Record<
            string,
            Record<
              string,
              { avg_price: number | null; currency: string | null }
            >
          >;

          for (const { year, month } of slice) {
            const yearKey = year.toString();
            const monthKey = MONTH_NAMES[month];
            const avg_price = hvObj?.[yearKey]?.[monthKey]?.avg_price;
            if (avg_price != null) {
              acc[yearKey][monthKey].sum += avg_price;
              acc[yearKey][monthKey].count += 1;
            }
          }
        }

        // Resolve to final averaged values
        priceHistory = {};
        for (const [yearKey, months] of Object.entries(acc)) {
          priceHistory[yearKey] = {};
          for (const [monthKey, { sum, count }] of Object.entries(months)) {
            priceHistory[yearKey][monthKey] =
              count > 0 ? parseFloat((sum / count).toFixed(2)) : 0;
          }
        }
      } else if (isOldYearPeriod) {
        // Full 12 months for the selected old year
        const monthlyAcc: Record<string, { sum: number; count: number }> =
          Object.fromEntries(MONTH_NAMES.map((m) => [m, { sum: 0, count: 0 }]));

        for (const bag of bags) {
          if (!bag.historicalValue) continue;
          const hvObj = bag.historicalValue as Record<
            string,
            Record<
              string,
              { avg_price: number | null; currency: string | null }
            >
          >;

          const yearData = hvObj[resolvedPeriod];
          if (!yearData) continue;

          for (const month of MONTH_NAMES) {
            const avg_price = yearData[month]?.avg_price;
            if (avg_price != null) {
              monthlyAcc[month].sum += avg_price;
              monthlyAcc[month].count += 1;
            }
          }
        }

        priceHistory = {
          [resolvedPeriod]: Object.fromEntries(
            MONTH_NAMES.map((month) => {
              const { sum, count } = monthlyAcc[month];
              return [
                month,
                count > 0 ? parseFloat((sum / count).toFixed(2)) : 0,
              ];
            })
          ),
        };
      }

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
        availablePeriods,
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
