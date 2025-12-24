// Utility functions shared between frontend and backend

import { 
  User, 
  Transaction, 
  SavingsGoal, 
  SpendingPattern, 
  Currency, 
  TransactionSource,
  AutomationRule,
  Category,
  Notification
} from '../types';

// Formatting utilities
export const formatCurrency = (amount: number, currency: string): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
};

export const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export const generateId = (): string => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

// Basic validation utilities
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePhoneNumber = (phone: string): boolean => {
  // Enhanced phone number validation for Kenyan numbers
  const phoneRegex = /^\+?[\d\s-()]+$/;
  const cleanPhone = phone.replace(/\D/g, '');
  
  // Check for Kenyan format (+254 or 07xx)
  if (phone.startsWith('+254') && cleanPhone.length === 12) return true;
  if (phone.startsWith('07') && cleanPhone.length === 10) return true;
  
  // General international format
  return phoneRegex.test(phone) && cleanPhone.length >= 10;
};

export const sanitizeString = (str: string): string => {
  return str.trim().replace(/[<>]/g, '');
};

export const calculatePercentage = (value: number, total: number): number => {
  if (total === 0) return 0;
  return Math.round((value / total) * 100 * 100) / 100; // Round to 2 decimal places
};

export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// Data validation functions
export const validateUser = (user: Partial<User>): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!user.email || !validateEmail(user.email)) {
    errors.push('Valid email is required');
  }

  if (!user.phoneNumber || !validatePhoneNumber(user.phoneNumber)) {
    errors.push('Valid phone number is required');
  }

  if (!user.country || user.country.length !== 2) {
    errors.push('Valid country code is required');
  }

  if (!user.currency || !['KES', 'USD', 'EUR', 'GBP'].includes(user.currency as Currency)) {
    errors.push('Valid currency is required');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateTransaction = (transaction: Partial<Transaction>): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!transaction.userId || transaction.userId.trim().length === 0) {
    errors.push('User ID is required');
  }

  if (typeof transaction.amount !== 'number' || transaction.amount <= 0) {
    errors.push('Amount must be a positive number');
  }

  if (!transaction.currency || !['KES', 'USD', 'EUR', 'GBP'].includes(transaction.currency as Currency)) {
    errors.push('Valid currency is required');
  }

  if (!transaction.description || transaction.description.trim().length === 0) {
    errors.push('Description is required');
  }

  if (!transaction.source || !['sms', 'api', 'manual'].includes(transaction.source as TransactionSource)) {
    errors.push('Valid transaction source is required');
  }

  if (!transaction.timestamp || !(transaction.timestamp instanceof Date)) {
    errors.push('Valid timestamp is required');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateSavingsGoal = (goal: Partial<SavingsGoal>): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!goal.userId || goal.userId.trim().length === 0) {
    errors.push('User ID is required');
  }

  if (!goal.name || goal.name.trim().length === 0) {
    errors.push('Goal name is required');
  }

  if (typeof goal.targetAmount !== 'number' || goal.targetAmount <= 0) {
    errors.push('Target amount must be a positive number');
  }

  if (typeof goal.currentAmount !== 'number' || goal.currentAmount < 0) {
    errors.push('Current amount must be a non-negative number');
  }

  if (!goal.deadline || !(goal.deadline instanceof Date) || goal.deadline <= new Date()) {
    errors.push('Deadline must be a future date');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateSpendingPattern = (pattern: Partial<SpendingPattern>): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!pattern.userId || pattern.userId.trim().length === 0) {
    errors.push('User ID is required');
  }

  if (!pattern.category || pattern.category.trim().length === 0) {
    errors.push('Category is required');
  }

  if (typeof pattern.averageMonthly !== 'number' || pattern.averageMonthly < 0) {
    errors.push('Average monthly amount must be a non-negative number');
  }

  if (!pattern.trend || !['increasing', 'decreasing', 'stable'].includes(pattern.trend)) {
    errors.push('Valid trend is required');
  }

  if (typeof pattern.anomalyScore !== 'number' || pattern.anomalyScore < 0 || pattern.anomalyScore > 1) {
    errors.push('Anomaly score must be between 0 and 1');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Data transformation and normalization functions
export const normalizeTransaction = (rawTransaction: any): Partial<Transaction> => {
  return {
    id: rawTransaction.id || generateId(),
    userId: sanitizeString(rawTransaction.userId || ''),
    amount: parseFloat(rawTransaction.amount) || 0,
    currency: (rawTransaction.currency || 'KES').toUpperCase(),
    description: sanitizeString(rawTransaction.description || ''),
    category: sanitizeString(rawTransaction.category || 'Uncategorized'),
    subcategory: rawTransaction.subcategory ? sanitizeString(rawTransaction.subcategory) : undefined,
    timestamp: rawTransaction.timestamp ? new Date(rawTransaction.timestamp) : new Date(),
    source: rawTransaction.source || 'manual',
    rawData: JSON.stringify(rawTransaction),
    isVerified: Boolean(rawTransaction.isVerified),
    location: rawTransaction.location ? sanitizeString(rawTransaction.location) : undefined,
    merchant: rawTransaction.merchant ? sanitizeString(rawTransaction.merchant) : undefined
  };
};

export const normalizeUser = (rawUser: any): Partial<User> => {
  return {
    id: rawUser.id || generateId(),
    email: sanitizeString(rawUser.email || '').toLowerCase(),
    phoneNumber: sanitizeString(rawUser.phoneNumber || ''),
    country: (rawUser.country || 'KE').toUpperCase(),
    currency: (rawUser.currency || 'KES').toUpperCase(),
    preferences: {
      language: rawUser.preferences?.language || 'en',
      notifications: {
        spendingAlerts: Boolean(rawUser.preferences?.notifications?.spendingAlerts ?? true),
        savingsReminders: Boolean(rawUser.preferences?.notifications?.savingsReminders ?? true),
        goalMilestones: Boolean(rawUser.preferences?.notifications?.goalMilestones ?? true),
        weeklyReports: Boolean(rawUser.preferences?.notifications?.weeklyReports ?? true)
      },
      savingsAutomation: {
        enabled: Boolean(rawUser.preferences?.savingsAutomation?.enabled ?? false),
        roundUpSavings: Boolean(rawUser.preferences?.savingsAutomation?.roundUpSavings ?? false),
        percentageSavings: parseFloat(rawUser.preferences?.savingsAutomation?.percentageSavings) || 0,
        minimumTransfer: parseFloat(rawUser.preferences?.savingsAutomation?.minimumTransfer) || 50,
        autoTransfer: Boolean(rawUser.preferences?.savingsAutomation?.autoTransfer ?? false)
      },
      categories: Array.isArray(rawUser.preferences?.categories) ? rawUser.preferences.categories : []
    },
    createdAt: rawUser.createdAt ? new Date(rawUser.createdAt) : new Date(),
    lastActive: rawUser.lastActive ? new Date(rawUser.lastActive) : new Date()
  };
};

export const normalizeSavingsGoal = (rawGoal: any): Partial<SavingsGoal> => {
  return {
    id: rawGoal.id || generateId(),
    userId: sanitizeString(rawGoal.userId || ''),
    name: sanitizeString(rawGoal.name || ''),
    targetAmount: parseFloat(rawGoal.targetAmount) || 0,
    currentAmount: parseFloat(rawGoal.currentAmount) || 0,
    deadline: rawGoal.deadline ? new Date(rawGoal.deadline) : new Date(),
    automationRules: Array.isArray(rawGoal.automationRules) ? rawGoal.automationRules : [],
    isActive: Boolean(rawGoal.isActive ?? true),
    createdAt: rawGoal.createdAt ? new Date(rawGoal.createdAt) : new Date(),
    updatedAt: rawGoal.updatedAt ? new Date(rawGoal.updatedAt) : new Date()
  };
};

// Currency conversion utilities
export const convertCurrency = (amount: number, fromCurrency: Currency, toCurrency: Currency, rates: Record<string, number>): number => {
  if (fromCurrency === toCurrency) return amount;
  
  const fromRate = rates[fromCurrency] || 1;
  const toRate = rates[toCurrency] || 1;
  
  return (amount / fromRate) * toRate;
};

// Date utilities
export const isToday = (date: Date): boolean => {
  const today = new Date();
  return date.toDateString() === today.toDateString();
};

export const isThisWeek = (date: Date): boolean => {
  const today = new Date();
  const weekStart = new Date(today.setDate(today.getDate() - today.getDay()));
  const weekEnd = new Date(today.setDate(today.getDate() - today.getDay() + 6));
  
  return date >= weekStart && date <= weekEnd;
};

export const isThisMonth = (date: Date): boolean => {
  const today = new Date();
  return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
};

// Array utilities
export const groupBy = <T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> => {
  return array.reduce((groups, item) => {
    const key = keyFn(item);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
    return groups;
  }, {} as Record<string, T[]>);
};

export const sortBy = <T>(array: T[], keyFn: (item: T) => any, direction: 'asc' | 'desc' = 'asc'): T[] => {
  return [...array].sort((a, b) => {
    const aVal = keyFn(a);
    const bVal = keyFn(b);
    
    if (direction === 'asc') {
      return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    } else {
      return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
    }
  });
};