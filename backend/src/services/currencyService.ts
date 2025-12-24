import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

/**
 * Currency Service
 * Handles real-time currency conversion and multi-currency support
 */

export interface CurrencyConfig {
  apiKey: string;
  baseUrl: string;
  baseCurrency: string;
  supportedCurrencies: string[];
  cacheExpiryMinutes: number;
  fallbackRates: Record<string, number>;
}

export interface ExchangeRate {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  timestamp: Date;
  source: string;
}

export interface ConversionResult {
  originalAmount: number;
  originalCurrency: string;
  convertedAmount: number;
  convertedCurrency: string;
  exchangeRate: number;
  timestamp: Date;
  source: string;
}

export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
  isSupported: boolean;
  country?: string;
}

export interface HistoricalRate {
  date: string;
  rate: number;
  currency: string;
  baseCurrency: string;
}

export class CurrencyService {
  private client: AxiosInstance;
  private config: CurrencyConfig;
  private rateCache: Map<string, { rate: ExchangeRate; expiry: Date }> = new Map();
  private supportedCurrencies: Map<string, CurrencyInfo> = new Map();

  constructor(config?: Partial<CurrencyConfig>) {
    this.config = {
      apiKey: process.env.CURRENCY_API_KEY || '',
      baseUrl: process.env.CURRENCY_API_URL || 'https://api.exchangerate-api.com/v4',
      baseCurrency: 'KES',
      supportedCurrencies: ['KES', 'USD', 'EUR', 'GBP', 'UGX', 'TZS', 'RWF'],
      cacheExpiryMinutes: 60,
      fallbackRates: {
        'USD': 0.0067, // 1 KES = 0.0067 USD (approximate)
        'EUR': 0.0061, // 1 KES = 0.0061 EUR (approximate)
        'GBP': 0.0053, // 1 KES = 0.0053 GBP (approximate)
        'UGX': 24.5,   // 1 KES = 24.5 UGX (approximate)
        'TZS': 18.2,   // 1 KES = 18.2 TZS (approximate)
        'RWF': 9.8,    // 1 KES = 9.8 RWF (approximate)
      },
      ...config,
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.initializeSupportedCurrencies();
    this.setupInterceptors();
  }

  /**
   * Initialize supported currencies with their metadata
   */
  private initializeSupportedCurrencies(): void {
    const currencies: CurrencyInfo[] = [
      {
        code: 'KES',
        name: 'Kenyan Shilling',
        symbol: 'KSh',
        decimalPlaces: 2,
        isSupported: true,
        country: 'Kenya',
      },
      {
        code: 'USD',
        name: 'US Dollar',
        symbol: '$',
        decimalPlaces: 2,
        isSupported: true,
        country: 'United States',
      },
      {
        code: 'EUR',
        name: 'Euro',
        symbol: '€',
        decimalPlaces: 2,
        isSupported: true,
        country: 'European Union',
      },
      {
        code: 'GBP',
        name: 'British Pound',
        symbol: '£',
        decimalPlaces: 2,
        isSupported: true,
        country: 'United Kingdom',
      },
      {
        code: 'UGX',
        name: 'Ugandan Shilling',
        symbol: 'USh',
        decimalPlaces: 0,
        isSupported: true,
        country: 'Uganda',
      },
      {
        code: 'TZS',
        name: 'Tanzanian Shilling',
        symbol: 'TSh',
        decimalPlaces: 0,
        isSupported: true,
        country: 'Tanzania',
      },
      {
        code: 'RWF',
        name: 'Rwandan Franc',
        symbol: 'RF',
        decimalPlaces: 0,
        isSupported: true,
        country: 'Rwanda',
      },
    ];

    currencies.forEach(currency => {
      this.supportedCurrencies.set(currency.code, currency);
    });

    logger.info('Currency service initialized', {
      supportedCurrencies: currencies.map(c => c.code),
      baseCurrency: this.config.baseCurrency,
    });
  }

  /**
   * Setup HTTP interceptors
   */
  private setupInterceptors(): void {
    this.client.interceptors.request.use(
      (config) => {
        if (this.config.apiKey) {
          config.headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        }
        
        logger.info('Currency API request', {
          url: config.url,
          method: config.method?.toUpperCase(),
        });
        
        return config;
      },
      (error) => {
        logger.error('Currency API request error', { error: error.message });
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        logger.info('Currency API response', {
          status: response.status,
          url: response.config.url,
        });
        return response;
      },
      (error) => {
        logger.error('Currency API response error', {
          status: error.response?.status,
          message: error.response?.data?.message || error.message,
          url: error.config?.url,
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get current exchange rate between two currencies
   */
  async getExchangeRate(fromCurrency: string, toCurrency: string): Promise<ExchangeRate> {
    try {
      // Check if currencies are supported
      if (!this.isCurrencySupported(fromCurrency) || !this.isCurrencySupported(toCurrency)) {
        throw new Error(`Unsupported currency pair: ${fromCurrency}/${toCurrency}`);
      }

      // Return 1:1 rate for same currency
      if (fromCurrency === toCurrency) {
        return {
          fromCurrency,
          toCurrency,
          rate: 1,
          timestamp: new Date(),
          source: 'internal',
        };
      }

      // Check cache first
      const cacheKey = `${fromCurrency}_${toCurrency}`;
      const cached = this.rateCache.get(cacheKey);
      
      if (cached && new Date() < cached.expiry) {
        logger.info('Using cached exchange rate', { fromCurrency, toCurrency, rate: cached.rate.rate });
        return cached.rate;
      }

      // Fetch from API
      logger.info('Fetching exchange rate from API', { fromCurrency, toCurrency });

      let rate: number;
      let source = 'api';

      try {
        const response = await this.client.get(`/latest/${fromCurrency}`);
        const rates = response.data.rates;
        
        if (!rates || !rates[toCurrency]) {
          throw new Error(`Rate not available for ${toCurrency}`);
        }
        
        rate = parseFloat(rates[toCurrency]);
      } catch (apiError) {
        logger.warn('API request failed, using fallback rates', {
          fromCurrency,
          toCurrency,
          error: apiError instanceof Error ? apiError.message : 'Unknown error',
        });

        // Use fallback rates
        rate = this.getFallbackRate(fromCurrency, toCurrency);
        source = 'fallback';
      }

      const exchangeRate: ExchangeRate = {
        fromCurrency,
        toCurrency,
        rate,
        timestamp: new Date(),
        source,
      };

      // Cache the rate
      const expiry = new Date(Date.now() + this.config.cacheExpiryMinutes * 60 * 1000);
      this.rateCache.set(cacheKey, { rate: exchangeRate, expiry });

      logger.info('Exchange rate retrieved', {
        fromCurrency,
        toCurrency,
        rate,
        source,
      });

      return exchangeRate;

    } catch (error) {
      logger.error('Failed to get exchange rate', {
        fromCurrency,
        toCurrency,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(`Failed to get exchange rate: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert amount from one currency to another
   */
  async convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ): Promise<ConversionResult> {
    try {
      if (amount < 0) {
        throw new Error('Amount must be positive');
      }

      const exchangeRate = await this.getExchangeRate(fromCurrency, toCurrency);
      const convertedAmount = amount * exchangeRate.rate;

      // Round to appropriate decimal places
      const toCurrencyInfo = this.supportedCurrencies.get(toCurrency);
      const decimalPlaces = toCurrencyInfo?.decimalPlaces ?? 2;
      const roundedAmount = Math.round(convertedAmount * Math.pow(10, decimalPlaces)) / Math.pow(10, decimalPlaces);

      const result: ConversionResult = {
        originalAmount: amount,
        originalCurrency: fromCurrency,
        convertedAmount: roundedAmount,
        convertedCurrency: toCurrency,
        exchangeRate: exchangeRate.rate,
        timestamp: exchangeRate.timestamp,
        source: exchangeRate.source,
      };

      logger.info('Currency conversion completed', {
        originalAmount: amount,
        fromCurrency,
        convertedAmount: roundedAmount,
        toCurrency,
        rate: exchangeRate.rate,
      });

      return result;

    } catch (error) {
      logger.error('Currency conversion failed', {
        amount,
        fromCurrency,
        toCurrency,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(`Currency conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get multiple exchange rates for a base currency
   */
  async getMultipleRates(baseCurrency: string, targetCurrencies: string[]): Promise<ExchangeRate[]> {
    try {
      const rates: ExchangeRate[] = [];

      for (const targetCurrency of targetCurrencies) {
        try {
          const rate = await this.getExchangeRate(baseCurrency, targetCurrency);
          rates.push(rate);
        } catch (error) {
          logger.warn('Failed to get rate for currency', {
            baseCurrency,
            targetCurrency,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      logger.info('Multiple exchange rates retrieved', {
        baseCurrency,
        targetCurrencies,
        successCount: rates.length,
      });

      return rates;

    } catch (error) {
      logger.error('Failed to get multiple exchange rates', {
        baseCurrency,
        targetCurrencies,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(`Failed to get multiple exchange rates: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get historical exchange rates
   */
  async getHistoricalRates(
    baseCurrency: string,
    targetCurrency: string,
    startDate: Date,
    endDate: Date
  ): Promise<HistoricalRate[]> {
    try {
      logger.info('Fetching historical exchange rates', {
        baseCurrency,
        targetCurrency,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      });

      // In a real implementation, this would fetch historical data from the API
      // For now, we'll simulate historical data
      const rates: HistoricalRate[] = [];
      const currentDate = new Date(startDate);
      const baseRate = await this.getExchangeRate(baseCurrency, targetCurrency);

      while (currentDate <= endDate) {
        // Simulate rate fluctuation (±5% from current rate)
        const fluctuation = (Math.random() - 0.5) * 0.1; // ±5%
        const historicalRate = baseRate.rate * (1 + fluctuation);

        rates.push({
          date: currentDate.toISOString().split('T')[0],
          rate: Math.round(historicalRate * 10000) / 10000, // 4 decimal places
          currency: targetCurrency,
          baseCurrency,
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }

      logger.info('Historical rates generated', {
        baseCurrency,
        targetCurrency,
        rateCount: rates.length,
      });

      return rates;

    } catch (error) {
      logger.error('Failed to get historical rates', {
        baseCurrency,
        targetCurrency,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(`Failed to get historical rates: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Format currency amount with proper symbol and formatting
   */
  formatCurrency(amount: number, currencyCode: string, locale?: string): string {
    try {
      const currencyInfo = this.supportedCurrencies.get(currencyCode);
      
      if (!currencyInfo) {
        return `${amount} ${currencyCode}`;
      }

      // Use appropriate locale for formatting
      const formatLocale = locale || this.getLocaleForCurrency(currencyCode);
      
      // Round to appropriate decimal places
      const roundedAmount = Math.round(amount * Math.pow(10, currencyInfo.decimalPlaces)) / Math.pow(10, currencyInfo.decimalPlaces);

      // Format using Intl.NumberFormat
      const formatter = new Intl.NumberFormat(formatLocale, {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: currencyInfo.decimalPlaces,
        maximumFractionDigits: currencyInfo.decimalPlaces,
      });

      return formatter.format(roundedAmount);

    } catch (error) {
      logger.warn('Currency formatting failed, using fallback', {
        amount,
        currencyCode,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Fallback formatting
      const currencyInfo = this.supportedCurrencies.get(currencyCode);
      const symbol = currencyInfo?.symbol || currencyCode;
      return `${symbol} ${amount.toFixed(currencyInfo?.decimalPlaces || 2)}`;
    }
  }

  /**
   * Get supported currencies
   */
  getSupportedCurrencies(): CurrencyInfo[] {
    return Array.from(this.supportedCurrencies.values());
  }

  /**
   * Check if currency is supported
   */
  isCurrencySupported(currencyCode: string): boolean {
    return this.supportedCurrencies.has(currencyCode);
  }

  /**
   * Get currency information
   */
  getCurrencyInfo(currencyCode: string): CurrencyInfo | undefined {
    return this.supportedCurrencies.get(currencyCode);
  }

  /**
   * Set user's preferred currency
   */
  setUserCurrencyPreference(userId: string, currencyCode: string): void {
    if (!this.isCurrencySupported(currencyCode)) {
      throw new Error(`Unsupported currency: ${currencyCode}`);
    }

    // In a real implementation, this would save to database
    logger.info('User currency preference updated', { userId, currencyCode });
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; message: string; lastUpdate?: Date }> {
    try {
      // Test API connectivity with a simple rate request
      await this.getExchangeRate('USD', 'EUR');
      
      return {
        status: 'healthy',
        message: 'Currency service is operational',
        lastUpdate: new Date(),
      };
    } catch (error) {
      // Check if we can use fallback rates
      try {
        this.getFallbackRate('USD', 'EUR');
        return {
          status: 'degraded',
          message: 'Currency service using fallback rates',
          lastUpdate: new Date(),
        };
      } catch (fallbackError) {
        return {
          status: 'unhealthy',
          message: `Currency service error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    }
  }

  /**
   * Clear rate cache
   */
  clearCache(): void {
    this.rateCache.clear();
    logger.info('Currency rate cache cleared');
  }

  /**
   * Get fallback exchange rate
   */
  private getFallbackRate(fromCurrency: string, toCurrency: string): number {
    if (fromCurrency === toCurrency) {
      return 1;
    }

    // Convert through KES as base currency
    if (fromCurrency === 'KES') {
      const rate = this.config.fallbackRates[toCurrency];
      if (!rate) {
        throw new Error(`No fallback rate available for ${toCurrency}`);
      }
      return rate;
    }

    if (toCurrency === 'KES') {
      const rate = this.config.fallbackRates[fromCurrency];
      if (!rate) {
        throw new Error(`No fallback rate available for ${fromCurrency}`);
      }
      return 1 / rate;
    }

    // Convert through KES (from -> KES -> to)
    const fromToKes = this.config.fallbackRates[fromCurrency];
    const kesToTo = this.config.fallbackRates[toCurrency];

    if (!fromToKes || !kesToTo) {
      throw new Error(`No fallback rate available for ${fromCurrency}/${toCurrency}`);
    }

    return kesToTo / fromToKes;
  }

  /**
   * Get appropriate locale for currency formatting
   */
  private getLocaleForCurrency(currencyCode: string): string {
    const localeMap: Record<string, string> = {
      'KES': 'en-KE',
      'USD': 'en-US',
      'EUR': 'en-EU',
      'GBP': 'en-GB',
      'UGX': 'en-UG',
      'TZS': 'en-TZ',
      'RWF': 'en-RW',
    };

    return localeMap[currencyCode] || 'en-US';
  }
}

// Export singleton instance
export const currencyService = new CurrencyService();