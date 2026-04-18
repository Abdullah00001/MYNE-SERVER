import { injectable } from 'tsyringe';

import { CURRENCIES } from '@/const';

type Currency = (typeof CURRENCIES)[number];

@injectable()
export class Simulation {
  /**
   * Get a random currency from the available currencies
   */
  private getRandomCurrency(): Currency {
    const randomIndex = Math.floor(Math.random() * CURRENCIES.length);
    return CURRENCIES[randomIndex];
  }

  /**
   * Generate random price range based on currency
   * Different currencies have different typical price ranges for luxury bags
   */
  private getRandomPriceForCurrency(currency: Currency): number {
    // Define realistic price ranges per currency (just for simulation variety)
    const priceRanges: Record<Currency, { min: number; max: number }> = {
      EUR: { min: 3000, max: 80000 },
      USD: { min: 3000, max: 85000 },
      GBP: { min: 2500, max: 70000 },
      CHF: { min: 3000, max: 75000 },
      JPY: { min: 400000, max: 10000000 }, // JPY has no decimals
      CAD: { min: 4000, max: 100000 },
      AUD: { min: 4500, max: 110000 },
    };

    const range = priceRanges[currency];
    const randomPrice = Math.random() * (range.max - range.min) + range.min;

    // Round based on currency
    if (currency === 'JPY') {
      return Math.round(randomPrice); // JPY has no decimals
    }
    return parseFloat(randomPrice.toFixed(2));
  }

  /**
   * Simulates AI API response for bag price analysis
   * Returns raw data as if coming from an AI service
   * No parameters - completely random generation
   */
  simulateRealisticAIAnalysis() {
    // Randomly select currency
    const selectedCurrency = this.getRandomCurrency();

    // More realistic trend distribution (market tends to be stable or slightly up)
    const trendWeights = [
      { trend: 'up' as const, weight: 0.45 },
      { trend: 'down' as const, weight: 0.35 },
      { trend: 'stable' as const, weight: 0.2 },
    ];

    const random = Math.random();
    let cumulative = 0;
    let selectedTrend: 'up' | 'down' | 'stable' = 'stable';

    for (const { trend, weight } of trendWeights) {
      cumulative += weight;
      if (random <= cumulative) {
        selectedTrend = trend;
        break;
      }
    }

    // More realistic change percentages
    let changePercentage: number;
    if (selectedTrend === 'up') {
      // Most gains are modest (0-15%), rare spikes (15-30%)
      const isLargeGain = Math.random() < 0.1;
      changePercentage = parseFloat(
        (isLargeGain
          ? Math.random() * 15 + 15 // 15-30%
          : Math.random() * 15
        ).toFixed(1)
      );
    } else if (selectedTrend === 'down') {
      // Most losses are modest (0-12%), rare crashes (12-25%)
      const isLargeLoss = Math.random() < 0.15;
      changePercentage = parseFloat(
        (isLargeLoss
          ? -(Math.random() * 13 + 12) // -12 to -25%
          : -(Math.random() * 12)
        ).toFixed(1)
      );
    } else {
      // Neutral: very small changes
      changePercentage = parseFloat((Math.random() * 2 - 1).toFixed(1)); // -1 to 1%
    }

    // Generate random price for the currency
    const randomBasePrice = this.getRandomPriceForCurrency(selectedCurrency);
    let currentValue = randomBasePrice * (1 + changePercentage / 100);

    // Round based on currency
    if (selectedCurrency === 'JPY') {
      currentValue = Math.round(currentValue);
    } else {
      currentValue = parseFloat(currentValue.toFixed(2));
    }

    // Production year with vintage premium consideration
    const currentYear = new Date().getFullYear();
    const vintageChance = Math.random();
    let randomYear: number;

    if (vintageChance < 0.1) {
      // 10% chance: vintage (20-30 years old)
      randomYear = currentYear - Math.floor(Math.random() * 10 + 20);
    } else if (vintageChance < 0.3) {
      // 20% chance: older (10-20 years)
      randomYear = currentYear - Math.floor(Math.random() * 10 + 10);
    } else {
      // 70% chance: recent (1-10 years)
      randomYear = currentYear - Math.floor(Math.random() * 10 + 1);
    }

    const randomMonth = Math.floor(Math.random() * 12);
    const productionYear = new Date(randomYear, randomMonth, 1);

    // Return raw data as if from AI API
    return {
      trend: selectedTrend,
      changePercentage,
      currentValue,
      currency: selectedCurrency,
      productionYear,
    };
  }
}
