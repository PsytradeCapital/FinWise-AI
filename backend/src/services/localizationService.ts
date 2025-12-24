import { logger } from '../utils/logger';

/**
 * Localization Service
 * Handles multi-language support and country-specific adaptations
 */

export interface LocalizationConfig {
  defaultLanguage: string;
  supportedLanguages: string[];
  defaultCountry: string;
  supportedCountries: string[];
  fallbackLanguage: string;
}

export interface TranslationKey {
  key: string;
  namespace?: string;
  context?: string;
}

export interface LocalizedContent {
  language: string;
  country: string;
  translations: Record<string, string>;
  dateFormat: string;
  numberFormat: string;
  currencyFormat: string;
  timeZone: string;
}

export interface CountryConfig {
  code: string;
  name: string;
  language: string;
  currency: string;
  dateFormat: string;
  numberFormat: string;
  timeZone: string;
  paymentMethods: string[];
  financialInstitutions: string[];
  culturalContext: {
    savingsTerms: string[];
    commonExpenses: string[];
    financialAdvice: string[];
  };
}

export class LocalizationService {
  private config: LocalizationConfig;
  private translations: Map<string, Record<string, string>> = new Map();
  private countryConfigs: Map<string, CountryConfig> = new Map();

  constructor(config?: Partial<LocalizationConfig>) {
    this.config = {
      defaultLanguage: 'en',
      supportedLanguages: ['en', 'sw'], // English and Swahili
      defaultCountry: 'KE',
      supportedCountries: ['KE', 'UG', 'TZ', 'RW', 'US', 'GB'],
      fallbackLanguage: 'en',
      ...config,
    };

    this.initializeTranslations();
    this.initializeCountryConfigs();
  }

  /**
   * Initialize translation dictionaries
   */
  private initializeTranslations(): void {
    // English translations
    this.translations.set('en', {
      // Common terms
      'common.welcome': 'Welcome',
      'common.hello': 'Hello',
      'common.goodbye': 'Goodbye',
      'common.thank_you': 'Thank you',
      'common.please': 'Please',
      'common.yes': 'Yes',
      'common.no': 'No',
      'common.save': 'Save',
      'common.cancel': 'Cancel',
      'common.continue': 'Continue',
      'common.back': 'Back',
      'common.next': 'Next',
      'common.loading': 'Loading...',
      'common.error': 'Error',
      'common.success': 'Success',

      // Financial terms
      'finance.transaction': 'Transaction',
      'finance.transactions': 'Transactions',
      'finance.balance': 'Balance',
      'finance.income': 'Income',
      'finance.expense': 'Expense',
      'finance.savings': 'Savings',
      'finance.goal': 'Goal',
      'finance.goals': 'Goals',
      'finance.budget': 'Budget',
      'finance.category': 'Category',
      'finance.categories': 'Categories',
      'finance.amount': 'Amount',
      'finance.date': 'Date',
      'finance.description': 'Description',
      'finance.total': 'Total',

      // App-specific terms
      'app.name': 'FinWise AI',
      'app.tagline': 'Your AI-powered financial companion',
      'app.dashboard': 'Dashboard',
      'app.profile': 'Profile',
      'app.settings': 'Settings',
      'app.help': 'Help',
      'app.logout': 'Logout',

      // Messages
      'messages.transaction_added': 'Transaction added successfully',
      'messages.goal_created': 'Savings goal created',
      'messages.budget_exceeded': 'Budget limit exceeded',
      'messages.savings_milestone': 'Congratulations! You reached your savings milestone',
      'messages.login_success': 'Login successful',
      'messages.login_failed': 'Login failed',

      // Advice and tips
      'advice.save_regularly': 'Save a little bit regularly rather than large amounts occasionally',
      'advice.track_expenses': 'Track your expenses to understand your spending patterns',
      'advice.emergency_fund': 'Build an emergency fund covering 3-6 months of expenses',
      'advice.avoid_debt': 'Avoid unnecessary debt and pay off existing debts quickly',
      'advice.invest_wisely': 'Consider investing for long-term financial growth',

      // Kenyan context
      'kenya.mpesa': 'M-Pesa',
      'kenya.chama': 'Chama',
      'kenya.harambee': 'Harambee',
      'kenya.table_banking': 'Table Banking',
      'kenya.shilling': 'Shilling',
      'kenya.shillings': 'Shillings',
    });

    // Swahili translations
    this.translations.set('sw', {
      // Common terms
      'common.welcome': 'Karibu',
      'common.hello': 'Hujambo',
      'common.goodbye': 'Kwaheri',
      'common.thank_you': 'Asante',
      'common.please': 'Tafadhali',
      'common.yes': 'Ndiyo',
      'common.no': 'Hapana',
      'common.save': 'Hifadhi',
      'common.cancel': 'Ghairi',
      'common.continue': 'Endelea',
      'common.back': 'Rudi',
      'common.next': 'Ifuatayo',
      'common.loading': 'Inapakia...',
      'common.error': 'Hitilafu',
      'common.success': 'Mafanikio',

      // Financial terms
      'finance.transaction': 'Muamala',
      'finance.transactions': 'Miamala',
      'finance.balance': 'Salio',
      'finance.income': 'Mapato',
      'finance.expense': 'Matumizi',
      'finance.savings': 'Akiba',
      'finance.goal': 'Lengo',
      'finance.goals': 'Malengo',
      'finance.budget': 'Bajeti',
      'finance.category': 'Jamii',
      'finance.categories': 'Majamii',
      'finance.amount': 'Kiasi',
      'finance.date': 'Tarehe',
      'finance.description': 'Maelezo',
      'finance.total': 'Jumla',

      // App-specific terms
      'app.name': 'FinWise AI',
      'app.tagline': 'Mshauri wako wa kifedha wa AI',
      'app.dashboard': 'Dashibodi',
      'app.profile': 'Wasifu',
      'app.settings': 'Mipangilio',
      'app.help': 'Msaada',
      'app.logout': 'Toka',

      // Messages
      'messages.transaction_added': 'Muamala umeongezwa kwa mafanikio',
      'messages.goal_created': 'Lengo la akiba limeundwa',
      'messages.budget_exceeded': 'Kikomo cha bajeti kimezidishwa',
      'messages.savings_milestone': 'Hongera! Umefika lengo lako la akiba',
      'messages.login_success': 'Kuingia kumefanikiwa',
      'messages.login_failed': 'Kuingia kumeshindwa',

      // Advice and tips
      'advice.save_regularly': 'Weka akiba kidogo kila wakati badala ya kiasi kikubwa mara chache',
      'advice.track_expenses': 'Fuatilia matumizi yako ili uelewa mifumo yako ya kutumia',
      'advice.emergency_fund': 'Jenga akiba ya dharura inayofunika miezi 3-6 ya gharama',
      'advice.avoid_debt': 'Epuka madeni yasiyohitajika na ulipe madeni yaliyopo haraka',
      'advice.invest_wisely': 'Fikiria kuwekezea ukuaji wa kifedha wa muda mrefu',

      // Kenyan context
      'kenya.mpesa': 'M-Pesa',
      'kenya.chama': 'Chama',
      'kenya.harambee': 'Harambee',
      'kenya.table_banking': 'Benki ya Meza',
      'kenya.shilling': 'Shilingi',
      'kenya.shillings': 'Shilingi',
    });

    logger.info('Translations initialized', {
      languages: Array.from(this.translations.keys()),
      translationCount: this.translations.get('en') ? Object.keys(this.translations.get('en')!).length : 0,
    });
  }

  /**
   * Initialize country-specific configurations
   */
  private initializeCountryConfigs(): void {
    const configs: CountryConfig[] = [
      {
        code: 'KE',
        name: 'Kenya',
        language: 'sw',
        currency: 'KES',
        dateFormat: 'DD/MM/YYYY',
        numberFormat: '1,234.56',
        timeZone: 'Africa/Nairobi',
        paymentMethods: ['M-Pesa', 'Airtel Money', 'T-Kash', 'Bank Transfer', 'Cash'],
        financialInstitutions: [
          'Equity Bank', 'KCB Bank', 'Cooperative Bank', 'Standard Chartered',
          'Barclays Bank', 'NCBA Bank', 'Absa Bank', 'DTB Bank'
        ],
        culturalContext: {
          savingsTerms: ['Akiba', 'Chama', 'Table Banking', 'Harambee', 'Merry-go-round'],
          commonExpenses: [
            'Chakula', 'Nauli', 'Kodi', 'Stima', 'Maji', 'Simu', 'Dawa',
            'Shule', 'Nguo', 'Mafuta'
          ],
          financialAdvice: [
            'Weka akiba kila mwezi',
            'Jiunge na chama cha akiba',
            'Tumia M-Pesa kwa usalama',
            'Panga bajeti yako',
            'Epuka mikopo mingi'
          ],
        },
      },
      {
        code: 'UG',
        name: 'Uganda',
        language: 'en',
        currency: 'UGX',
        dateFormat: 'DD/MM/YYYY',
        numberFormat: '1,234',
        timeZone: 'Africa/Kampala',
        paymentMethods: ['Mobile Money', 'Bank Transfer', 'Cash'],
        financialInstitutions: [
          'Stanbic Bank', 'Centenary Bank', 'DFCU Bank', 'Equity Bank Uganda'
        ],
        culturalContext: {
          savingsTerms: ['Savings', 'SACCO', 'Village Savings', 'Group Savings'],
          commonExpenses: ['Food', 'Transport', 'Rent', 'Utilities', 'Education'],
          financialAdvice: [
            'Save regularly in a SACCO',
            'Use mobile money safely',
            'Plan your budget monthly',
            'Avoid unnecessary loans'
          ],
        },
      },
      {
        code: 'TZ',
        name: 'Tanzania',
        language: 'sw',
        currency: 'TZS',
        dateFormat: 'DD/MM/YYYY',
        numberFormat: '1,234',
        timeZone: 'Africa/Dar_es_Salaam',
        paymentMethods: ['M-Pesa', 'Tigo Pesa', 'Airtel Money', 'Bank Transfer', 'Cash'],
        financialInstitutions: [
          'CRDB Bank', 'NMB Bank', 'Equity Bank Tanzania', 'Standard Chartered'
        ],
        culturalContext: {
          savingsTerms: ['Akiba', 'VICOBA', 'SACCOS', 'Upatu'],
          commonExpenses: ['Chakula', 'Usafiri', 'Kodi', 'Elimu', 'Afya'],
          financialAdvice: [
            'Weka akiba katika SACCOS',
            'Tumia huduma za kifedha kwa usalama',
            'Panga bajeti ya kila mwezi'
          ],
        },
      },
      {
        code: 'RW',
        name: 'Rwanda',
        language: 'en',
        currency: 'RWF',
        dateFormat: 'DD/MM/YYYY',
        numberFormat: '1,234',
        timeZone: 'Africa/Kigali',
        paymentMethods: ['MTN Mobile Money', 'Airtel Money', 'Bank Transfer', 'Cash'],
        financialInstitutions: [
          'Bank of Kigali', 'Equity Bank Rwanda', 'Cogebanque', 'Access Bank'
        ],
        culturalContext: {
          savingsTerms: ['Savings', 'Cooperative', 'Tontine', 'SACCO'],
          commonExpenses: ['Food', 'Transport', 'Housing', 'Education', 'Healthcare'],
          financialAdvice: [
            'Join a savings cooperative',
            'Use mobile money for convenience',
            'Build an emergency fund'
          ],
        },
      },
    ];

    configs.forEach(config => {
      this.countryConfigs.set(config.code, config);
    });

    logger.info('Country configurations initialized', {
      countries: configs.map(c => `${c.name} (${c.code})`),
    });
  }

  /**
   * Get translation for a key
   */
  translate(key: string, language?: string, variables?: Record<string, string>): string {
    const lang = language || this.config.defaultLanguage;
    const translations = this.translations.get(lang) || this.translations.get(this.config.fallbackLanguage);

    if (!translations) {
      logger.warn('No translations found', { language: lang, key });
      return key;
    }

    let translation = translations[key];
    
    if (!translation) {
      // Try fallback language
      const fallbackTranslations = this.translations.get(this.config.fallbackLanguage);
      translation = fallbackTranslations?.[key] || key;
      
      if (translation === key) {
        logger.warn('Translation not found', { language: lang, key });
      }
    }

    // Replace variables in translation
    if (variables) {
      Object.entries(variables).forEach(([variable, value]) => {
        translation = translation.replace(new RegExp(`{{${variable}}}`, 'g'), value);
      });
    }

    return translation;
  }

  /**
   * Get multiple translations
   */
  translateMultiple(keys: string[], language?: string): Record<string, string> {
    const result: Record<string, string> = {};
    
    keys.forEach(key => {
      result[key] = this.translate(key, language);
    });

    return result;
  }

  /**
   * Get localized content for a country and language
   */
  getLocalizedContent(countryCode: string, language?: string): LocalizedContent {
    const country = this.countryConfigs.get(countryCode);
    const lang = language || country?.language || this.config.defaultLanguage;
    const translations = this.translations.get(lang) || {};

    return {
      language: lang,
      country: countryCode,
      translations,
      dateFormat: country?.dateFormat || 'MM/DD/YYYY',
      numberFormat: country?.numberFormat || '1,234.56',
      currencyFormat: country?.currency || 'USD',
      timeZone: country?.timeZone || 'UTC',
    };
  }

  /**
   * Get country-specific configuration
   */
  getCountryConfig(countryCode: string): CountryConfig | undefined {
    return this.countryConfigs.get(countryCode);
  }

  /**
   * Get supported countries
   */
  getSupportedCountries(): CountryConfig[] {
    return Array.from(this.countryConfigs.values());
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): string[] {
    return this.config.supportedLanguages;
  }

  /**
   * Check if language is supported
   */
  isLanguageSupported(language: string): boolean {
    return this.config.supportedLanguages.includes(language);
  }

  /**
   * Check if country is supported
   */
  isCountrySupported(countryCode: string): boolean {
    return this.countryConfigs.has(countryCode);
  }

  /**
   * Format date according to country preferences
   */
  formatDate(date: Date, countryCode: string): string {
    const country = this.countryConfigs.get(countryCode);
    const format = country?.dateFormat || 'MM/DD/YYYY';

    try {
      const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: country?.timeZone || 'UTC',
      };

      const formatter = new Intl.DateTimeFormat('en-US', options);
      const formatted = formatter.format(date);

      // Convert to desired format
      if (format === 'DD/MM/YYYY') {
        const [month, day, year] = formatted.split('/');
        return `${day}/${month}/${year}`;
      }

      return formatted;
    } catch (error) {
      logger.warn('Date formatting failed, using fallback', {
        date: date.toISOString(),
        countryCode,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return date.toLocaleDateString();
    }
  }

  /**
   * Format number according to country preferences
   */
  formatNumber(number: number, countryCode: string): string {
    const country = this.countryConfigs.get(countryCode);
    
    try {
      const locale = this.getLocaleForCountry(countryCode);
      return new Intl.NumberFormat(locale).format(number);
    } catch (error) {
      logger.warn('Number formatting failed, using fallback', {
        number,
        countryCode,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return number.toString();
    }
  }

  /**
   * Get culturally appropriate financial advice
   */
  getLocalizedFinancialAdvice(countryCode: string, language?: string): string[] {
    const country = this.countryConfigs.get(countryCode);
    const lang = language || country?.language || this.config.defaultLanguage;

    if (!country) {
      return this.translate('advice.save_regularly', lang).split('\n');
    }

    // Return localized advice from country config
    if (lang === 'sw' && country.culturalContext.financialAdvice.length > 0) {
      return country.culturalContext.financialAdvice;
    }

    // Translate generic advice
    return [
      this.translate('advice.save_regularly', lang),
      this.translate('advice.track_expenses', lang),
      this.translate('advice.emergency_fund', lang),
      this.translate('advice.avoid_debt', lang),
    ];
  }

  /**
   * Get local payment methods
   */
  getLocalPaymentMethods(countryCode: string): string[] {
    const country = this.countryConfigs.get(countryCode);
    return country?.paymentMethods || ['Bank Transfer', 'Cash'];
  }

  /**
   * Get local financial institutions
   */
  getLocalFinancialInstitutions(countryCode: string): string[] {
    const country = this.countryConfigs.get(countryCode);
    return country?.financialInstitutions || [];
  }

  /**
   * Add or update translation
   */
  addTranslation(language: string, key: string, value: string): void {
    if (!this.translations.has(language)) {
      this.translations.set(language, {});
    }

    const translations = this.translations.get(language)!;
    translations[key] = value;

    logger.info('Translation added/updated', { language, key });
  }

  /**
   * Get locale string for country
   */
  private getLocaleForCountry(countryCode: string): string {
    const localeMap: Record<string, string> = {
      'KE': 'en-KE',
      'UG': 'en-UG',
      'TZ': 'sw-TZ',
      'RW': 'en-RW',
      'US': 'en-US',
      'GB': 'en-GB',
    };

    return localeMap[countryCode] || 'en-US';
  }
}

// Export singleton instance
export const localizationService = new LocalizationService();