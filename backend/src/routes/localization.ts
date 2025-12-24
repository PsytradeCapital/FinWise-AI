import { Router, Request, Response } from 'express';
import { currencyService } from '../services/currencyService';
import { localizationService } from '../services/localizationService';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Get exchange rate between two currencies
 */
router.get('/currency/rate/:from/:to', async (req: Request, res: Response): Promise<void> => {
  try {
    const { from, to } = req.params;

    if (!from || !to) {
      res.status(400).json({
        success: false,
        error: 'From and to currencies are required',
      });
      return;
    }

    const exchangeRate = await currencyService.getExchangeRate(from.toUpperCase(), to.toUpperCase());

    res.json({
      success: true,
      data: exchangeRate,
    });
  } catch (error) {
    logger.error('Failed to get exchange rate', {
      from: req.params.from,
      to: req.params.to,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get exchange rate',
    });
  }
});

/**
 * Convert currency amount
 */
router.post('/currency/convert', async (req: Request, res: Response): Promise<void> => {
  try {
    const { amount, fromCurrency, toCurrency } = req.body;

    if (!amount || !fromCurrency || !toCurrency) {
      res.status(400).json({
        success: false,
        error: 'Amount, fromCurrency, and toCurrency are required',
      });
      return;
    }

    const conversion = await currencyService.convertCurrency(
      parseFloat(amount),
      fromCurrency.toUpperCase(),
      toCurrency.toUpperCase()
    );

    res.json({
      success: true,
      data: conversion,
    });
  } catch (error) {
    logger.error('Currency conversion failed', {
      amount: req.body.amount,
      fromCurrency: req.body.fromCurrency,
      toCurrency: req.body.toCurrency,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Currency conversion failed',
    });
  }
});

/**
 * Get multiple exchange rates for a base currency
 */
router.get('/currency/rates/:baseCurrency', async (req: Request, res: Response): Promise<void> => {
  try {
    const { baseCurrency } = req.params;
    const { targets } = req.query;

    if (!baseCurrency) {
      res.status(400).json({
        success: false,
        error: 'Base currency is required',
      });
      return;
    }

    let targetCurrencies: string[];
    if (targets) {
      targetCurrencies = (targets as string).split(',').map(c => c.trim().toUpperCase());
    } else {
      // Default to common currencies
      targetCurrencies = ['USD', 'EUR', 'GBP', 'KES', 'UGX', 'TZS'];
    }

    const rates = await currencyService.getMultipleRates(baseCurrency.toUpperCase(), targetCurrencies);

    res.json({
      success: true,
      data: {
        baseCurrency: baseCurrency.toUpperCase(),
        rates,
      },
    });
  } catch (error) {
    logger.error('Failed to get multiple exchange rates', {
      baseCurrency: req.params.baseCurrency,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get exchange rates',
    });
  }
});

/**
 * Get historical exchange rates
 */
router.get('/currency/history/:baseCurrency/:targetCurrency', async (req: Request, res: Response): Promise<void> => {
  try {
    const { baseCurrency, targetCurrency } = req.params;
    const { startDate, endDate } = req.query;

    if (!baseCurrency || !targetCurrency) {
      res.status(400).json({
        success: false,
        error: 'Base currency and target currency are required',
      });
      return;
    }

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const end = endDate ? new Date(endDate as string) : new Date();

    const historicalRates = await currencyService.getHistoricalRates(
      baseCurrency.toUpperCase(),
      targetCurrency.toUpperCase(),
      start,
      end
    );

    res.json({
      success: true,
      data: {
        baseCurrency: baseCurrency.toUpperCase(),
        targetCurrency: targetCurrency.toUpperCase(),
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
        rates: historicalRates,
      },
    });
  } catch (error) {
    logger.error('Failed to get historical rates', {
      baseCurrency: req.params.baseCurrency,
      targetCurrency: req.params.targetCurrency,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get historical rates',
    });
  }
});

/**
 * Format currency amount
 */
router.post('/currency/format', async (req: Request, res: Response): Promise<void> => {
  try {
    const { amount, currency, locale } = req.body;

    if (amount === undefined || !currency) {
      res.status(400).json({
        success: false,
        error: 'Amount and currency are required',
      });
      return;
    }

    const formatted = currencyService.formatCurrency(parseFloat(amount), currency.toUpperCase(), locale);

    res.json({
      success: true,
      data: {
        amount: parseFloat(amount),
        currency: currency.toUpperCase(),
        formatted,
        locale: locale || 'default',
      },
    });
  } catch (error) {
    logger.error('Currency formatting failed', {
      amount: req.body.amount,
      currency: req.body.currency,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Currency formatting failed',
    });
  }
});

/**
 * Get supported currencies
 */
router.get('/currency/supported', async (req: Request, res: Response): Promise<void> => {
  try {
    const currencies = currencyService.getSupportedCurrencies();

    res.json({
      success: true,
      data: currencies,
    });
  } catch (error) {
    logger.error('Failed to get supported currencies', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get supported currencies',
    });
  }
});

/**
 * Get currency service health
 */
router.get('/currency/health', async (req: Request, res: Response): Promise<void> => {
  try {
    const health = await currencyService.getHealthStatus();

    res.json({
      success: true,
      data: health,
    });
  } catch (error) {
    logger.error('Failed to get currency service health', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get currency service health',
    });
  }
});

/**
 * Get translation for a key
 */
router.get('/translate/:key', async (req: Request, res: Response): Promise<void> => {
  try {
    const { key } = req.params;
    const { language, variables } = req.query;

    if (!key) {
      res.status(400).json({
        success: false,
        error: 'Translation key is required',
      });
      return;
    }

    let parsedVariables: Record<string, string> | undefined;
    if (variables) {
      try {
        parsedVariables = JSON.parse(variables as string);
      } catch (error) {
        res.status(400).json({
          success: false,
          error: 'Invalid variables format. Must be valid JSON.',
        });
        return;
      }
    }

    const translation = localizationService.translate(key, language as string, parsedVariables);

    res.json({
      success: true,
      data: {
        key,
        language: language || 'default',
        translation,
        variables: parsedVariables,
      },
    });
  } catch (error) {
    logger.error('Translation failed', {
      key: req.params.key,
      language: req.query.language,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      success: false,
      error: 'Translation failed',
    });
  }
});

/**
 * Get multiple translations
 */
router.post('/translate/multiple', async (req: Request, res: Response): Promise<void> => {
  try {
    const { keys, language } = req.body;

    if (!keys || !Array.isArray(keys)) {
      res.status(400).json({
        success: false,
        error: 'Keys array is required',
      });
      return;
    }

    const translations = localizationService.translateMultiple(keys, language);

    res.json({
      success: true,
      data: {
        language: language || 'default',
        translations,
      },
    });
  } catch (error) {
    logger.error('Multiple translations failed', {
      keys: req.body.keys,
      language: req.body.language,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      success: false,
      error: 'Multiple translations failed',
    });
  }
});

/**
 * Get localized content for a country
 */
router.get('/localized-content/:countryCode', async (req: Request, res: Response): Promise<void> => {
  try {
    const { countryCode } = req.params;
    const { language } = req.query;

    if (!countryCode) {
      res.status(400).json({
        success: false,
        error: 'Country code is required',
      });
      return;
    }

    const content = localizationService.getLocalizedContent(countryCode.toUpperCase(), language as string);

    res.json({
      success: true,
      data: content,
    });
  } catch (error) {
    logger.error('Failed to get localized content', {
      countryCode: req.params.countryCode,
      language: req.query.language,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get localized content',
    });
  }
});

/**
 * Get country configuration
 */
router.get('/country/:countryCode', async (req: Request, res: Response): Promise<void> => {
  try {
    const { countryCode } = req.params;

    if (!countryCode) {
      res.status(400).json({
        success: false,
        error: 'Country code is required',
      });
      return;
    }

    const config = localizationService.getCountryConfig(countryCode.toUpperCase());

    if (!config) {
      res.status(404).json({
        success: false,
        error: `Country configuration not found for: ${countryCode}`,
      });
      return;
    }

    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    logger.error('Failed to get country configuration', {
      countryCode: req.params.countryCode,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get country configuration',
    });
  }
});

/**
 * Get supported countries
 */
router.get('/countries', async (req: Request, res: Response): Promise<void> => {
  try {
    const countries = localizationService.getSupportedCountries();

    res.json({
      success: true,
      data: countries,
    });
  } catch (error) {
    logger.error('Failed to get supported countries', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get supported countries',
    });
  }
});

/**
 * Get supported languages
 */
router.get('/languages', async (req: Request, res: Response): Promise<void> => {
  try {
    const languages = localizationService.getSupportedLanguages();

    res.json({
      success: true,
      data: languages,
    });
  } catch (error) {
    logger.error('Failed to get supported languages', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get supported languages',
    });
  }
});

/**
 * Get localized financial advice
 */
router.get('/advice/:countryCode', async (req: Request, res: Response): Promise<void> => {
  try {
    const { countryCode } = req.params;
    const { language } = req.query;

    if (!countryCode) {
      res.status(400).json({
        success: false,
        error: 'Country code is required',
      });
      return;
    }

    const advice = localizationService.getLocalizedFinancialAdvice(
      countryCode.toUpperCase(),
      language as string
    );

    res.json({
      success: true,
      data: {
        countryCode: countryCode.toUpperCase(),
        language: language || 'default',
        advice,
      },
    });
  } catch (error) {
    logger.error('Failed to get localized financial advice', {
      countryCode: req.params.countryCode,
      language: req.query.language,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get localized financial advice',
    });
  }
});

/**
 * Get local payment methods
 */
router.get('/payment-methods/:countryCode', async (req: Request, res: Response): Promise<void> => {
  try {
    const { countryCode } = req.params;

    if (!countryCode) {
      res.status(400).json({
        success: false,
        error: 'Country code is required',
      });
      return;
    }

    const paymentMethods = localizationService.getLocalPaymentMethods(countryCode.toUpperCase());

    res.json({
      success: true,
      data: {
        countryCode: countryCode.toUpperCase(),
        paymentMethods,
      },
    });
  } catch (error) {
    logger.error('Failed to get local payment methods', {
      countryCode: req.params.countryCode,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get local payment methods',
    });
  }
});

/**
 * Get local financial institutions
 */
router.get('/financial-institutions/:countryCode', async (req: Request, res: Response): Promise<void> => {
  try {
    const { countryCode } = req.params;

    if (!countryCode) {
      res.status(400).json({
        success: false,
        error: 'Country code is required',
      });
      return;
    }

    const institutions = localizationService.getLocalFinancialInstitutions(countryCode.toUpperCase());

    res.json({
      success: true,
      data: {
        countryCode: countryCode.toUpperCase(),
        institutions,
      },
    });
  } catch (error) {
    logger.error('Failed to get local financial institutions', {
      countryCode: req.params.countryCode,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get local financial institutions',
    });
  }
});

export default router;