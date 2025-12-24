// Application constants

export const CURRENCIES = {
  KES: 'KES',
  USD: 'USD',
  EUR: 'EUR',
  GBP: 'GBP',
} as const;

export const LANGUAGES = {
  EN: 'en',
  SW: 'sw',
} as const;

export const COUNTRIES = {
  KENYA: 'KE',
  UNITED_STATES: 'US',
  UNITED_KINGDOM: 'UK',
  EUROPEAN_UNION: 'EU',
} as const;

export const TRANSACTION_SOURCES = {
  SMS: 'sms',
  API: 'api',
  MANUAL: 'manual',
} as const;

export const DEFAULT_CATEGORIES = [
  { name: 'Food & Dining', icon: '🍽️', color: '#FF6B6B' },
  { name: 'Transportation', icon: '🚗', color: '#4ECDC4' },
  { name: 'Shopping', icon: '🛍️', color: '#45B7D1' },
  { name: 'Entertainment', icon: '🎬', color: '#96CEB4' },
  { name: 'Bills & Utilities', icon: '💡', color: '#FFEAA7' },
  { name: 'Healthcare', icon: '🏥', color: '#DDA0DD' },
  { name: 'Education', icon: '📚', color: '#98D8C8' },
  { name: 'Travel', icon: '✈️', color: '#F7DC6F' },
  { name: 'Savings', icon: '💰', color: '#82E0AA' },
  { name: 'Other', icon: '📝', color: '#D5DBDB' },
];

export const MINIMUM_TRANSFER_AMOUNT = {
  KES: 50,
  USD: 0.5,
  EUR: 0.5,
  GBP: 0.4,
};

export const API_ENDPOINTS = {
  TRANSACTIONS: '/api/transactions',
  USERS: '/api/users',
  GOALS: '/api/goals',
  CATEGORIES: '/api/categories',
  ADVICE: '/api/advice',
  STORIES: '/api/stories',
  NOTIFICATIONS: '/api/notifications',
};

export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network connection error. Please check your internet connection.',
  INVALID_CREDENTIALS: 'Invalid email or password.',
  USER_NOT_FOUND: 'User not found.',
  TRANSACTION_FAILED: 'Transaction processing failed. Please try again.',
  INSUFFICIENT_FUNDS: 'Insufficient funds for this transaction.',
  INVALID_INPUT: 'Please check your input and try again.',
  SERVER_ERROR: 'Server error. Please try again later.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
};

export const SUCCESS_MESSAGES = {
  TRANSACTION_SAVED: 'Transaction saved successfully.',
  GOAL_CREATED: 'Savings goal created successfully.',
  CATEGORY_ADDED: 'Category added successfully.',
  PROFILE_UPDATED: 'Profile updated successfully.',
  TRANSFER_COMPLETED: 'Transfer completed successfully.',
};

// Validation constants
export const VALIDATION_RULES = {
  EMAIL: {
    MIN_LENGTH: 5,
    MAX_LENGTH: 254,
    REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
  PHONE: {
    MIN_LENGTH: 10,
    MAX_LENGTH: 15,
    KENYAN_REGEX: /^(\+254|0)[17]\d{8}$/,
  },
  PASSWORD: {
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBER: true,
    REQUIRE_SPECIAL: true,
  },
  TRANSACTION: {
    MIN_AMOUNT: 0.01,
    MAX_AMOUNT: 1000000,
    DESCRIPTION_MAX_LENGTH: 255,
  },
  GOAL: {
    NAME_MAX_LENGTH: 100,
    MIN_TARGET_AMOUNT: 1,
    MAX_TARGET_AMOUNT: 10000000,
  },
  CATEGORY: {
    NAME_MAX_LENGTH: 50,
    MAX_CUSTOM_CATEGORIES: 20,
  },
};

// SMS parsing patterns for different providers
export const SMS_PATTERNS = {
  MPESA: {
    SENT: /^([A-Z0-9]+)\s+Confirmed\.\s+Ksh([\d,]+\.\d{2})\s+sent\s+to\s+(.+?)\s+on\s+(\d{1,2}\/\d{1,2}\/\d{2})\s+at\s+(\d{1,2}:\d{2}\s+[AP]M)/i,
    RECEIVED: /^([A-Z0-9]+)\s+Confirmed\.\s+You\s+have\s+received\s+Ksh([\d,]+\.\d{2})\s+from\s+(.+?)\s+on\s+(\d{1,2}\/\d{1,2}\/\d{2})\s+at\s+(\d{1,2}:\d{2}\s+[AP]M)/i,
    PAYBILL: /^([A-Z0-9]+)\s+Confirmed\.\s+Ksh([\d,]+\.\d{2})\s+paid\s+to\s+(.+?)\.\s+on\s+(\d{1,2}\/\d{1,2}\/\d{2})\s+at\s+(\d{1,2}:\d{2}\s+[AP]M)/i,
  },
  AIRTEL_MONEY: {
    SENT: /Transaction\s+ID:\s+([A-Z0-9]+).*?Amount:\s+KES\s+([\d,]+\.\d{2}).*?To:\s+(.+?).*?Date:\s+(\d{2}\/\d{2}\/\d{4})/i,
    RECEIVED: /Transaction\s+ID:\s+([A-Z0-9]+).*?Amount:\s+KES\s+([\d,]+\.\d{2}).*?From:\s+(.+?).*?Date:\s+(\d{2}\/\d{2}\/\d{4})/i,
  },
};

// Configuration constants
export const CONFIG = {
  PAGINATION: {
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
  },
  CACHE: {
    USER_TTL: 3600, // 1 hour
    TRANSACTION_TTL: 1800, // 30 minutes
    RATES_TTL: 300, // 5 minutes
  },
  RETRY: {
    MAX_ATTEMPTS: 3,
    INITIAL_DELAY: 1000, // 1 second
    BACKOFF_MULTIPLIER: 2,
  },
  NOTIFICATIONS: {
    BATCH_SIZE: 50,
    RETRY_DELAY: 5000, // 5 seconds
  },
  ML: {
    ANOMALY_THRESHOLD: 0.7,
    MIN_TRANSACTIONS_FOR_PATTERN: 10,
    PATTERN_ANALYSIS_WINDOW_DAYS: 90,
  },
};

// Feature flags
export const FEATURES = {
  VOICE_INPUT: true,
  BIOMETRIC_AUTH: true,
  OFFLINE_MODE: true,
  PUSH_NOTIFICATIONS: true,
  ANALYTICS: true,
  BETA_FEATURES: false,
};

// External service configurations
export const EXTERNAL_SERVICES = {
  MPESA: {
    SANDBOX_URL: 'https://sandbox.safaricom.co.ke',
    PRODUCTION_URL: 'https://api.safaricom.co.ke',
    TIMEOUT: 30000, // 30 seconds
  },
  NABO_CAPITAL: {
    SANDBOX_URL: 'https://sandbox-api.nabocapital.com',
    PRODUCTION_URL: 'https://api.nabocapital.com',
    TIMEOUT: 30000,
  },
  CURRENCY_API: {
    URL: 'https://api.exchangerate-api.com/v4/latest',
    TIMEOUT: 10000, // 10 seconds
    CACHE_DURATION: 3600000, // 1 hour
  },
};