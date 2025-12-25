// Type declarations for @finwise-ai/shared module
declare module '@finwise-ai/shared' {
  export interface User {
    id: string;
    email: string;
    phoneNumber: string;
    country: string;
    currency: string;
    preferences: UserPreferences;
    createdAt: Date;
    lastActive: Date;
  }

  export interface UserPreferences {
    language: string;
    notifications: NotificationPreferences;
    savingsAutomation: SavingsPreferences;
    categories: string[];
  }

  export interface NotificationPreferences {
    spendingAlerts: boolean;
    savingsReminders: boolean;
    goalMilestones: boolean;
    weeklyReports: boolean;
  }

  export interface SavingsPreferences {
    enabled: boolean;
    roundUpSavings: boolean;
    percentageSavings: number;
    minimumTransfer: number;
    autoTransfer: boolean;
  }

  export interface Transaction {
    id: string;
    userId: string;
    amount: number;
    currency: string;
    description: string;
    category: string;
    subcategory?: string;
    timestamp: Date;
    source: 'sms' | 'api' | 'manual';
    rawData: string;
    isVerified: boolean;
    location?: string;
    merchant?: string;
  }

  export interface SavingsGoal {
    id: string;
    userId: string;
    name: string;
    targetAmount: number;
    currentAmount: number;
    deadline: Date;
    automationRules: AutomationRule[];
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }

  export interface AutomationRule {
    id: string;
    type: 'roundup' | 'percentage' | 'fixed';
    value: number;
    conditions?: RuleCondition[];
    isActive: boolean;
  }

  export interface RuleCondition {
    field: string;
    operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
    value: string | number;
  }

  export interface SpendingPattern {
    userId: string;
    category: string;
    averageMonthly: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    anomalyScore: number;
    lastAnalyzed: Date;
    confidence: number;
  }

  export interface Anomaly {
    id: string;
    userId: string;
    transactionId: string;
    type: 'amount' | 'frequency' | 'category' | 'location';
    severity: 'low' | 'medium' | 'high';
    description: string;
    detectedAt: Date;
    isResolved: boolean;
  }

  export interface Advice {
    id: string;
    userId: string;
    type: 'spending' | 'saving' | 'goal' | 'general';
    title: string;
    message: string;
    actionable: boolean;
    priority: 'low' | 'medium' | 'high';
    createdAt: Date;
    expiresAt?: Date;
  }

  export interface MoneyStory {
    id: string;
    userId: string;
    period: 'weekly' | 'monthly';
    title: string;
    narrative: string;
    insights: string[];
    suggestions: string[];
    sentiment: 'positive' | 'neutral' | 'negative';
    createdAt: Date;
  }

  export interface Category {
    id: string;
    name: string;
    icon: string;
    color: string;
    isDefault: boolean;
    parentId?: string;
    userId?: string;
  }

  export interface Notification {
    id: string;
    userId: string;
    type: 'alert' | 'reminder' | 'achievement' | 'advice';
    title: string;
    message: string;
    isRead: boolean;
    createdAt: Date;
    data?: Record<string, any>;
  }

  export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
  }

  export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
    hasNext: boolean;
    hasPrev: boolean;
  }

  export interface MpesaTransaction {
    transactionId: string;
    amount: number;
    phoneNumber: string;
    recipient: string;
    timestamp: string;
    status: 'completed' | 'pending' | 'failed';
  }

  export interface BankTransaction {
    id: string;
    accountId: string;
    amount: number;
    description: string;
    date: string;
    balance: number;
    type: 'debit' | 'credit';
  }

  export interface NaboCapitalTransfer {
    transferId: string;
    amount: number;
    status: 'pending' | 'completed' | 'failed';
    createdAt: string;
    completedAt?: string;
    failureReason?: string;
  }

  export type TransactionSource = 'sms' | 'api' | 'manual';
  export type Currency = 'KES' | 'USD' | 'EUR' | 'GBP';
  export type Language = 'en' | 'sw';
  export type Country = 'KE' | 'US' | 'UK' | 'EU';
}