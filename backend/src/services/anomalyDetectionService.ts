import { Transaction, SpendingPattern, Anomaly } from '@shared/types';
import { logger } from '../utils/logger';

/**
 * Anomaly Detection Service using Isolation Forest algorithm
 * Detects unusual spending patterns and behaviors
 */

interface SpendingDataPoint {
  amount: number;
  category: string;
  timestamp: Date;
  dayOfWeek: number;
  hourOfDay: number;
  merchantFrequency: number;
  categoryFrequency: number;
}

interface IsolationNode {
  feature?: string;
  threshold?: number;
  left?: IsolationNode;
  right?: IsolationNode;
  size?: number;
  depth?: number;
}

class IsolationTree {
  private root: IsolationNode | null = null;
  private maxDepth: number;

  constructor(maxDepth: number = 10) {
    this.maxDepth = maxDepth;
  }

  build(data: SpendingDataPoint[], depth: number = 0): IsolationNode {
    if (data.length <= 1 || depth >= this.maxDepth) {
      return { size: data.length, depth };
    }

    // Randomly select feature and threshold
    const features = ['amount', 'dayOfWeek', 'hourOfDay', 'merchantFrequency', 'categoryFrequency'];
    const feature = features[Math.floor(Math.random() * features.length)];
    
    const values = data.map(d => this.getFeatureValue(d, feature));
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    if (min === max) {
      return { size: data.length, depth };
    }

    const threshold = Math.random() * (max - min) + min;

    const leftData = data.filter(d => this.getFeatureValue(d, feature) < threshold);
    const rightData = data.filter(d => this.getFeatureValue(d, feature) >= threshold);

    return {
      feature,
      threshold,
      left: this.build(leftData, depth + 1),
      right: this.build(rightData, depth + 1),
      size: data.length,
      depth
    };
  }

  private getFeatureValue(dataPoint: SpendingDataPoint, feature: string): number {
    switch (feature) {
      case 'amount': return dataPoint.amount;
      case 'dayOfWeek': return dataPoint.dayOfWeek;
      case 'hourOfDay': return dataPoint.hourOfDay;
      case 'merchantFrequency': return dataPoint.merchantFrequency;
      case 'categoryFrequency': return dataPoint.categoryFrequency;
      default: return 0;
    }
  }

  pathLength(dataPoint: SpendingDataPoint, node: IsolationNode = this.root!, depth: number = 0): number {
    if (!node.feature || !node.threshold) {
      // Leaf node - estimate path length
      return depth + this.estimatePathLength(node.size || 1);
    }

    const featureValue = this.getFeatureValue(dataPoint, node.feature);
    
    if (featureValue < node.threshold) {
      return this.pathLength(dataPoint, node.left!, depth + 1);
    } else {
      return this.pathLength(dataPoint, node.right!, depth + 1);
    }
  }

  private estimatePathLength(size: number): number {
    if (size <= 1) return 0;
    return 2 * (Math.log(size - 1) + 0.5772156649) - (2 * (size - 1) / size);
  }

  fit(data: SpendingDataPoint[]): void {
    this.root = this.build(data);
  }
}

class IsolationForest {
  private trees: IsolationTree[] = [];
  private numTrees: number;
  private sampleSize: number;

  constructor(numTrees: number = 100, sampleSize: number = 256) {
    this.numTrees = numTrees;
    this.sampleSize = sampleSize;
  }

  fit(data: SpendingDataPoint[]): void {
    this.trees = [];
    
    for (let i = 0; i < this.numTrees; i++) {
      const tree = new IsolationTree();
      
      // Sample data for this tree
      const sampleData = this.sampleData(data, Math.min(this.sampleSize, data.length));
      tree.fit(sampleData);
      
      this.trees.push(tree);
    }
  }

  private sampleData(data: SpendingDataPoint[], size: number): SpendingDataPoint[] {
    const sampled = [];
    for (let i = 0; i < size; i++) {
      const randomIndex = Math.floor(Math.random() * data.length);
      sampled.push(data[randomIndex]);
    }
    return sampled;
  }

  anomalyScore(dataPoint: SpendingDataPoint): number {
    if (this.trees.length === 0) return 0;

    const avgPathLength = this.trees.reduce((sum, tree) => {
      return sum + tree.pathLength(dataPoint);
    }, 0) / this.trees.length;

    // Normalize score between 0 and 1
    const expectedPathLength = this.estimateExpectedPathLength(this.sampleSize);
    return Math.pow(2, -avgPathLength / expectedPathLength);
  }

  private estimateExpectedPathLength(size: number): number {
    if (size <= 1) return 0;
    return 2 * (Math.log(size - 1) + 0.5772156649) - (2 * (size - 1) / size);
  }
}

export class AnomalyDetectionService {
  private isolationForest: IsolationForest;
  private isModelTrained: boolean = false;

  constructor() {
    this.isolationForest = new IsolationForest();
  }

  /**
   * Train the anomaly detection model with historical transaction data
   */
  async trainModel(transactions: Transaction[]): Promise<void> {
    try {
      logger.info('Training anomaly detection model', { transactionCount: transactions.length });

      if (transactions.length < 10) {
        logger.warn('Insufficient data for training anomaly detection model');
        return;
      }

      const dataPoints = await this.prepareTrainingData(transactions);
      this.isolationForest.fit(dataPoints);
      this.isModelTrained = true;

      logger.info('Anomaly detection model trained successfully');
    } catch (error) {
      logger.error('Error training anomaly detection model', { error });
      throw error;
    }
  }

  /**
   * Detect spending anomalies for a user
   */
  async detectSpendingAnomalies(userId: string, transactions: Transaction[]): Promise<Anomaly[]> {
    try {
      if (!this.isModelTrained) {
        await this.trainModel(transactions);
      }

      const anomalies: Anomaly[] = [];
      const recentTransactions = transactions
        .filter(t => t.userId === userId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 100); // Analyze last 100 transactions

      for (const transaction of recentTransactions) {
        const dataPoint = await this.transactionToDataPoint(transaction, transactions);
        const anomalyScore = this.isolationForest.anomalyScore(dataPoint);

        // Threshold for anomaly detection (adjustable)
        if (anomalyScore > 0.6) {
          const anomaly = await this.createAnomaly(transaction, anomalyScore);
          anomalies.push(anomaly);
        }
      }

      logger.info('Anomaly detection completed', { 
        userId, 
        transactionsAnalyzed: recentTransactions.length,
        anomaliesFound: anomalies.length 
      });

      return anomalies;
    } catch (error) {
      logger.error('Error detecting spending anomalies', { userId, error });
      throw error;
    }
  }

  /**
   * Analyze spending patterns using time series analysis
   */
  async analyzeSpendingPatterns(userId: string, transactions: Transaction[]): Promise<SpendingPattern[]> {
    try {
      const userTransactions = transactions.filter(t => t.userId === userId);
      const patterns: SpendingPattern[] = [];

      // Group transactions by category
      const categoryGroups = this.groupTransactionsByCategory(userTransactions);

      for (const [category, categoryTransactions] of categoryGroups.entries()) {
        const pattern = await this.analyzeCategory(userId, category, categoryTransactions);
        patterns.push(pattern);
      }

      return patterns;
    } catch (error) {
      logger.error('Error analyzing spending patterns', { userId, error });
      throw error;
    }
  }

  /**
   * Build threshold-based alerting for unusual spending
   */
  async checkSpendingThresholds(userId: string, transactions: Transaction[]): Promise<Anomaly[]> {
    try {
      const alerts: Anomaly[] = [];
      const userTransactions = transactions.filter(t => t.userId === userId);

      // Calculate spending baselines
      const dailyBaseline = this.calculateDailySpendingBaseline(userTransactions);
      const categoryBaselines = this.calculateCategoryBaselines(userTransactions);

      // Check recent transactions against thresholds
      const today = new Date();
      const todayTransactions = userTransactions.filter(t => 
        new Date(t.timestamp).toDateString() === today.toDateString()
      );

      const todayTotal = todayTransactions.reduce((sum, t) => sum + t.amount, 0);

      // Daily spending threshold alert
      if (todayTotal > dailyBaseline * 2) {
        alerts.push({
          id: `daily-${userId}-${Date.now()}`,
          userId,
          transactionId: todayTransactions[0]?.id || '',
          type: 'amount',
          severity: 'high',
          description: `Daily spending (${todayTotal}) exceeds normal baseline (${dailyBaseline.toFixed(2)}) by 100%`,
          detectedAt: new Date(),
          isResolved: false
        });
      }

      // Category-based threshold alerts
      for (const [category, baseline] of categoryBaselines.entries()) {
        const categoryToday = todayTransactions
          .filter(t => t.category === category)
          .reduce((sum, t) => sum + t.amount, 0);

        if (categoryToday > baseline * 3) {
          alerts.push({
            id: `category-${category}-${userId}-${Date.now()}`,
            userId,
            transactionId: todayTransactions.find(t => t.category === category)?.id || '',
            type: 'category',
            severity: 'medium',
            description: `Spending in ${category} (${categoryToday}) exceeds normal baseline (${baseline.toFixed(2)}) by 200%`,
            detectedAt: new Date(),
            isResolved: false
          });
        }
      }

      return alerts;
    } catch (error) {
      logger.error('Error checking spending thresholds', { userId, error });
      throw error;
    }
  }

  private async prepareTrainingData(transactions: Transaction[]): Promise<SpendingDataPoint[]> {
    const dataPoints: SpendingDataPoint[] = [];
    const merchantFrequencies = this.calculateMerchantFrequencies(transactions);
    const categoryFrequencies = this.calculateCategoryFrequencies(transactions);

    for (const transaction of transactions) {
      const timestamp = new Date(transaction.timestamp);
      
      dataPoints.push({
        amount: transaction.amount,
        category: transaction.category,
        timestamp,
        dayOfWeek: timestamp.getDay(),
        hourOfDay: timestamp.getHours(),
        merchantFrequency: merchantFrequencies.get(transaction.merchant || '') || 0,
        categoryFrequency: categoryFrequencies.get(transaction.category) || 0
      });
    }

    return dataPoints;
  }

  private async transactionToDataPoint(transaction: Transaction, allTransactions: Transaction[]): Promise<SpendingDataPoint> {
    const merchantFrequencies = this.calculateMerchantFrequencies(allTransactions);
    const categoryFrequencies = this.calculateCategoryFrequencies(allTransactions);
    const timestamp = new Date(transaction.timestamp);

    return {
      amount: transaction.amount,
      category: transaction.category,
      timestamp,
      dayOfWeek: timestamp.getDay(),
      hourOfDay: timestamp.getHours(),
      merchantFrequency: merchantFrequencies.get(transaction.merchant || '') || 0,
      categoryFrequency: categoryFrequencies.get(transaction.category) || 0
    };
  }

  private calculateMerchantFrequencies(transactions: Transaction[]): Map<string, number> {
    const frequencies = new Map<string, number>();
    
    for (const transaction of transactions) {
      const merchant = transaction.merchant || '';
      frequencies.set(merchant, (frequencies.get(merchant) || 0) + 1);
    }

    return frequencies;
  }

  private calculateCategoryFrequencies(transactions: Transaction[]): Map<string, number> {
    const frequencies = new Map<string, number>();
    
    for (const transaction of transactions) {
      frequencies.set(transaction.category, (frequencies.get(transaction.category) || 0) + 1);
    }

    return frequencies;
  }

  private async createAnomaly(transaction: Transaction, score: number): Promise<Anomaly> {
    let severity: 'low' | 'medium' | 'high' = 'low';
    let description = 'Unusual spending pattern detected';

    if (score > 0.8) {
      severity = 'high';
      description = `Highly unusual transaction: ${transaction.description} (${transaction.amount})`;
    } else if (score > 0.7) {
      severity = 'medium';
      description = `Moderately unusual transaction: ${transaction.description} (${transaction.amount})`;
    }

    return {
      id: `anomaly-${transaction.id}-${Date.now()}`,
      userId: transaction.userId,
      transactionId: transaction.id,
      type: 'amount',
      severity,
      description,
      detectedAt: new Date(),
      isResolved: false
    };
  }

  private groupTransactionsByCategory(transactions: Transaction[]): Map<string, Transaction[]> {
    const groups = new Map<string, Transaction[]>();
    
    for (const transaction of transactions) {
      const category = transaction.category;
      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category)!.push(transaction);
    }

    return groups;
  }

  private async analyzeCategory(userId: string, category: string, transactions: Transaction[]): Promise<SpendingPattern> {
    const amounts = transactions.map(t => t.amount);
    const averageMonthly = this.calculateMonthlyAverage(transactions);
    const trend = this.calculateTrend(transactions);
    const anomalyScore = this.calculateCategoryAnomalyScore(transactions);

    return {
      userId,
      category,
      averageMonthly,
      trend,
      anomalyScore,
      lastAnalyzed: new Date(),
      confidence: Math.min(transactions.length / 10, 1) // Confidence based on data points
    };
  }

  private calculateMonthlyAverage(transactions: Transaction[]): number {
    if (transactions.length === 0) return 0;

    const total = transactions.reduce((sum, t) => sum + t.amount, 0);
    const oldestTransaction = new Date(Math.min(...transactions.map(t => new Date(t.timestamp).getTime())));
    const monthsSpan = Math.max(1, (Date.now() - oldestTransaction.getTime()) / (1000 * 60 * 60 * 24 * 30));

    return total / monthsSpan;
  }

  private calculateTrend(transactions: Transaction[]): 'increasing' | 'decreasing' | 'stable' {
    if (transactions.length < 4) return 'stable';

    const sortedTransactions = transactions.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const firstHalf = sortedTransactions.slice(0, Math.floor(sortedTransactions.length / 2));
    const secondHalf = sortedTransactions.slice(Math.floor(sortedTransactions.length / 2));

    const firstHalfAvg = firstHalf.reduce((sum, t) => sum + t.amount, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, t) => sum + t.amount, 0) / secondHalf.length;

    const changePercent = (secondHalfAvg - firstHalfAvg) / firstHalfAvg;

    if (changePercent > 0.1) return 'increasing';
    if (changePercent < -0.1) return 'decreasing';
    return 'stable';
  }

  private calculateCategoryAnomalyScore(transactions: Transaction[]): number {
    if (transactions.length < 3) return 0;

    const amounts = transactions.map(t => t.amount);
    const mean = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
    const variance = amounts.reduce((sum, a) => sum + Math.pow(a - mean, 2), 0) / amounts.length;
    const stdDev = Math.sqrt(variance);

    // Calculate coefficient of variation as anomaly indicator
    return stdDev / mean;
  }

  private calculateDailySpendingBaseline(transactions: Transaction[]): number {
    const dailyTotals = new Map<string, number>();

    for (const transaction of transactions) {
      const date = new Date(transaction.timestamp).toDateString();
      dailyTotals.set(date, (dailyTotals.get(date) || 0) + transaction.amount);
    }

    const totals = Array.from(dailyTotals.values());
    return totals.reduce((sum, total) => sum + total, 0) / totals.length;
  }

  private calculateCategoryBaselines(transactions: Transaction[]): Map<string, number> {
    const categoryTotals = new Map<string, number>();
    const categoryDays = new Map<string, Set<string>>();

    for (const transaction of transactions) {
      const category = transaction.category;
      const date = new Date(transaction.timestamp).toDateString();

      categoryTotals.set(category, (categoryTotals.get(category) || 0) + transaction.amount);
      
      if (!categoryDays.has(category)) {
        categoryDays.set(category, new Set());
      }
      categoryDays.get(category)!.add(date);
    }

    const baselines = new Map<string, number>();
    for (const [category, total] of categoryTotals.entries()) {
      const days = categoryDays.get(category)!.size;
      baselines.set(category, total / days);
    }

    return baselines;
  }
}