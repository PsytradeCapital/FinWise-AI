import { Transaction, SavingsGoal, User, SpendingPattern } from '@finwise-ai/shared';
import { logger } from '../utils/logger';
import * as htmlPdf from 'html-pdf-node';

/**
 * PDF Export Service
 * Handles generation of financial reports in PDF format for external use
 */

export interface FinancialReportData {
  user: User;
  reportPeriod: {
    startDate: Date;
    endDate: Date;
    type: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  };
  transactions: Transaction[];
  spendingPatterns: SpendingPattern[];
  savingsGoals: SavingsGoal[];
  summary: {
    totalIncome: number;
    totalExpenses: number;
    totalSavings: number;
    netCashFlow: number;
    topSpendingCategories: Array<{ category: string; amount: number; percentage: number }>;
  };
}

export interface PDFExportOptions {
  format: 'A4' | 'Letter';
  orientation: 'portrait' | 'landscape';
  includeCharts: boolean;
  includeTransactionDetails: boolean;
  includeSavingsGoals: boolean;
  includeSpendingAnalysis: boolean;
  watermark?: string;
}

export class PDFExportService {
  private readonly defaultOptions: PDFExportOptions = {
    format: 'A4',
    orientation: 'portrait',
    includeCharts: true,
    includeTransactionDetails: true,
    includeSavingsGoals: true,
    includeSpendingAnalysis: true
  };

  /**
   * Generate PDF report for financial data
   */
  async generateFinancialReport(
    reportData: FinancialReportData,
    options: Partial<PDFExportOptions> = {}
  ): Promise<Buffer> {
    try {
      logger.info('Generating PDF financial report', { 
        userId: reportData.user.id,
        reportType: reportData.reportPeriod.type
      });

      const finalOptions = { ...this.defaultOptions, ...options };
      const htmlContent = await this.generateReportHTML(reportData, finalOptions);
      
      const pdfOptions = {
        format: finalOptions.format,
        orientation: finalOptions.orientation,
        border: {
          top: '0.5in',
          right: '0.5in',
          bottom: '0.5in',
          left: '0.5in'
        },
        header: {
          height: '0.5in',
          contents: this.generateHeaderHTML(reportData)
        },
        footer: {
          height: '0.3in',
          contents: this.generateFooterHTML()
        }
      };

      const file = { content: htmlContent };
      const pdfBuffer = await htmlPdf.generatePdf(file, pdfOptions) as unknown as Buffer;

      logger.info('PDF financial report generated successfully', { 
        userId: reportData.user.id,
        bufferSize: pdfBuffer.length
      });

      return pdfBuffer;
    } catch (error) {
      logger.error('Error generating PDF financial report', { 
        userId: reportData.user.id, 
        error 
      });
      throw error;
    }
  }

  /**
   * Generate savings goal progress report
   */
  async generateSavingsGoalReport(
    user: User,
    goals: SavingsGoal[],
    options: Partial<PDFExportOptions> = {}
  ): Promise<Buffer> {
    try {
      logger.info('Generating PDF savings goal report', { userId: user.id });

      const finalOptions = { ...this.defaultOptions, ...options };
      const htmlContent = await this.generateSavingsGoalHTML(user, goals, finalOptions);
      
      const pdfOptions = {
        format: finalOptions.format,
        orientation: finalOptions.orientation,
        border: {
          top: '0.5in',
          right: '0.5in',
          bottom: '0.5in',
          left: '0.5in'
        }
      };

      const file = { content: htmlContent };
      const pdfBuffer = await htmlPdf.generatePdf(file, pdfOptions) as unknown as Buffer;

      logger.info('PDF savings goal report generated successfully', { userId: user.id });

      return pdfBuffer;
    } catch (error) {
      logger.error('Error generating PDF savings goal report', { userId: user.id, error });
      throw error;
    }
  }

  /**
   * Generate spending analysis report
   */
  async generateSpendingAnalysisReport(
    user: User,
    transactions: Transaction[],
    patterns: SpendingPattern[],
    options: Partial<PDFExportOptions> = {}
  ): Promise<Buffer> {
    try {
      logger.info('Generating PDF spending analysis report', { userId: user.id });

      const finalOptions = { ...this.defaultOptions, ...options };
      const htmlContent = await this.generateSpendingAnalysisHTML(user, transactions, patterns, finalOptions);
      
      const pdfOptions = {
        format: finalOptions.format,
        orientation: finalOptions.orientation,
        border: {
          top: '0.5in',
          right: '0.5in',
          bottom: '0.5in',
          left: '0.5in'
        }
      };

      const file = { content: htmlContent };
      const pdfBuffer = await htmlPdf.generatePdf(file, pdfOptions) as unknown as Buffer;

      logger.info('PDF spending analysis report generated successfully', { userId: user.id });

      return pdfBuffer;
    } catch (error) {
      logger.error('Error generating PDF spending analysis report', { userId: user.id, error });
      throw error;
    }
  }

  /**
   * Validate that financial data contains all required information for PDF generation
   */
  validateReportData(reportData: FinancialReportData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!reportData.user || !reportData.user.id) {
      errors.push('User information is required');
    }

    if (!reportData.reportPeriod || !reportData.reportPeriod.startDate || !reportData.reportPeriod.endDate) {
      errors.push('Report period with start and end dates is required');
    }

    if (!reportData.summary) {
      errors.push('Financial summary data is required');
    }

    if (!Array.isArray(reportData.transactions)) {
      errors.push('Transactions array is required');
    }

    if (!Array.isArray(reportData.spendingPatterns)) {
      errors.push('Spending patterns array is required');
    }

    if (!Array.isArray(reportData.savingsGoals)) {
      errors.push('Savings goals array is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private async generateReportHTML(
    reportData: FinancialReportData,
    options: PDFExportOptions
  ): Promise<string> {
    const { user, reportPeriod, summary, transactions, spendingPatterns, savingsGoals } = reportData;
    
    const formatCurrency = (amount: number) => `${user.currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    const formatDate = (date: Date) => date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    let html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>FinWise AI Financial Report</title>
        <style>
            ${this.getReportCSS()}
        </style>
    </head>
    <body>
        <div class="report-container">
            <div class="report-header">
                <h1>FinWise AI Financial Report</h1>
                <div class="report-info">
                    <p><strong>Report Period:</strong> ${formatDate(reportPeriod.startDate)} - ${formatDate(reportPeriod.endDate)}</p>
                    <p><strong>Generated for:</strong> ${user.email}</p>
                    <p><strong>Generated on:</strong> ${formatDate(new Date())}</p>
                </div>
            </div>

            <div class="executive-summary">
                <h2>Executive Summary</h2>
                <div class="summary-grid">
                    <div class="summary-item positive">
                        <h3>Total Income</h3>
                        <p class="amount">${formatCurrency(summary.totalIncome)}</p>
                    </div>
                    <div class="summary-item negative">
                        <h3>Total Expenses</h3>
                        <p class="amount">${formatCurrency(summary.totalExpenses)}</p>
                    </div>
                    <div class="summary-item positive">
                        <h3>Total Savings</h3>
                        <p class="amount">${formatCurrency(summary.totalSavings)}</p>
                    </div>
                    <div class="summary-item ${summary.netCashFlow >= 0 ? 'positive' : 'negative'}">
                        <h3>Net Cash Flow</h3>
                        <p class="amount">${formatCurrency(summary.netCashFlow)}</p>
                    </div>
                </div>
            </div>
    `;

    if (options.includeSpendingAnalysis) {
      html += this.generateSpendingAnalysisSection(summary.topSpendingCategories, spendingPatterns, formatCurrency);
    }

    if (options.includeSavingsGoals) {
      html += this.generateSavingsGoalsSection(savingsGoals, formatCurrency, formatDate);
    }

    if (options.includeTransactionDetails) {
      html += this.generateTransactionDetailsSection(transactions, formatCurrency, formatDate);
    }

    html += `
            <div class="report-footer">
                <p><em>This report was generated by FinWise AI on ${formatDate(new Date())}. All amounts are in ${user.currency}.</em></p>
                ${options.watermark ? `<div class="watermark">${options.watermark}</div>` : ''}
            </div>
        </div>
    </body>
    </html>
    `;

    return html;
  }

  private async generateSavingsGoalHTML(
    user: User,
    goals: SavingsGoal[],
    options: PDFExportOptions
  ): Promise<string> {
    const formatCurrency = (amount: number) => `${user.currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    const formatDate = (date: Date) => date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>FinWise AI Savings Goals Report</title>
        <style>
            ${this.getReportCSS()}
        </style>
    </head>
    <body>
        <div class="report-container">
            <div class="report-header">
                <h1>Savings Goals Progress Report</h1>
                <div class="report-info">
                    <p><strong>Generated for:</strong> ${user.email}</p>
                    <p><strong>Generated on:</strong> ${formatDate(new Date())}</p>
                </div>
            </div>

            ${this.generateSavingsGoalsSection(goals, formatCurrency, formatDate)}

            <div class="report-footer">
                <p><em>This report was generated by FinWise AI on ${formatDate(new Date())}.</em></p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  private async generateSpendingAnalysisHTML(
    user: User,
    transactions: Transaction[],
    patterns: SpendingPattern[],
    options: PDFExportOptions
  ): Promise<string> {
    const formatCurrency = (amount: number) => `${user.currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    const formatDate = (date: Date) => date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    // Calculate spending by category
    const categorySpending = transactions.reduce((acc, transaction) => {
      if (transaction.amount > 0) { // Only expenses
        acc[transaction.category] = (acc[transaction.category] || 0) + transaction.amount;
      }
      return acc;
    }, {} as Record<string, number>);

    const topCategories = Object.entries(categorySpending)
      .map(([category, amount]) => ({ category, amount, percentage: 0 }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    const totalSpending = topCategories.reduce((sum, cat) => sum + cat.amount, 0);
    topCategories.forEach(cat => {
      cat.percentage = (cat.amount / totalSpending) * 100;
    });

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>FinWise AI Spending Analysis Report</title>
        <style>
            ${this.getReportCSS()}
        </style>
    </head>
    <body>
        <div class="report-container">
            <div class="report-header">
                <h1>Spending Analysis Report</h1>
                <div class="report-info">
                    <p><strong>Generated for:</strong> ${user.email}</p>
                    <p><strong>Generated on:</strong> ${formatDate(new Date())}</p>
                </div>
            </div>

            ${this.generateSpendingAnalysisSection(topCategories, patterns, formatCurrency)}
            ${options.includeTransactionDetails ? this.generateTransactionDetailsSection(transactions, formatCurrency, formatDate) : ''}

            <div class="report-footer">
                <p><em>This report was generated by FinWise AI on ${formatDate(new Date())}.</em></p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  private generateSpendingAnalysisSection(
    topCategories: Array<{ category: string; amount: number; percentage: number }>,
    patterns: SpendingPattern[],
    formatCurrency: (amount: number) => string
  ): string {
    return `
    <div class="spending-analysis">
        <h2>Spending Analysis</h2>
        
        <div class="top-categories">
            <h3>Top Spending Categories</h3>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Category</th>
                        <th>Amount</th>
                        <th>Percentage</th>
                        <th>Trend</th>
                    </tr>
                </thead>
                <tbody>
                    ${topCategories.map(category => {
                      const pattern = patterns.find(p => p.category === category.category);
                      const trendIcon = pattern?.trend === 'increasing' ? '↗️' : 
                                       pattern?.trend === 'decreasing' ? '↘️' : '➡️';
                      return `
                        <tr>
                            <td>${category.category}</td>
                            <td>${formatCurrency(category.amount)}</td>
                            <td>${category.percentage.toFixed(1)}%</td>
                            <td>${trendIcon} ${pattern?.trend || 'stable'}</td>
                        </tr>
                      `;
                    }).join('')}
                </tbody>
            </table>
        </div>

        <div class="spending-trends">
            <h3>Spending Trends Analysis</h3>
            ${patterns.map(pattern => `
                <div class="trend-item">
                    <h4>${pattern.category}</h4>
                    <p>Monthly Average: ${formatCurrency(pattern.averageMonthly)}</p>
                    <p>Trend: <span class="trend-${pattern.trend}">${pattern.trend}</span></p>
                    <p>Confidence: ${(pattern.confidence * 100).toFixed(1)}%</p>
                </div>
            `).join('')}
        </div>
    </div>
    `;
  }

  private generateSavingsGoalsSection(
    goals: SavingsGoal[],
    formatCurrency: (amount: number) => string,
    formatDate: (date: Date) => string
  ): string {
    return `
    <div class="savings-goals">
        <h2>Savings Goals Progress</h2>
        
        ${goals.map(goal => {
          const progressPercentage = (goal.currentAmount / goal.targetAmount) * 100;
          const remainingAmount = goal.targetAmount - goal.currentAmount;
          const daysRemaining = Math.ceil((goal.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          
          return `
            <div class="goal-item">
                <h3>${goal.name}</h3>
                <div class="goal-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${Math.min(progressPercentage, 100)}%"></div>
                    </div>
                    <p class="progress-text">${progressPercentage.toFixed(1)}% Complete</p>
                </div>
                <div class="goal-details">
                    <p><strong>Target:</strong> ${formatCurrency(goal.targetAmount)}</p>
                    <p><strong>Current:</strong> ${formatCurrency(goal.currentAmount)}</p>
                    <p><strong>Remaining:</strong> ${formatCurrency(remainingAmount)}</p>
                    <p><strong>Deadline:</strong> ${formatDate(goal.deadline)}</p>
                    <p><strong>Days Remaining:</strong> ${daysRemaining > 0 ? daysRemaining : 'Overdue'}</p>
                    <p><strong>Status:</strong> <span class="status-${goal.isActive ? 'active' : 'inactive'}">${goal.isActive ? 'Active' : 'Inactive'}</span></p>
                </div>
            </div>
          `;
        }).join('')}
    </div>
    `;
  }

  private generateTransactionDetailsSection(
    transactions: Transaction[],
    formatCurrency: (amount: number) => string,
    formatDate: (date: Date) => string
  ): string {
    // Sort transactions by date (most recent first)
    const sortedTransactions = transactions
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 50); // Limit to 50 most recent transactions

    return `
    <div class="transaction-details">
        <h2>Recent Transactions</h2>
        <table class="data-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Category</th>
                    <th>Amount</th>
                    <th>Source</th>
                </tr>
            </thead>
            <tbody>
                ${sortedTransactions.map(transaction => `
                    <tr>
                        <td>${formatDate(transaction.timestamp)}</td>
                        <td>${transaction.description}</td>
                        <td>${transaction.category}</td>
                        <td class="${transaction.amount > 0 ? 'expense' : 'income'}">${formatCurrency(Math.abs(transaction.amount))}</td>
                        <td>${transaction.source}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
    `;
  }

  private generateHeaderHTML(reportData: FinancialReportData): string {
    return `
    <div style="text-align: center; font-size: 10px; color: #666;">
        FinWise AI Financial Report - ${reportData.user.email}
    </div>
    `;
  }

  private generateFooterHTML(): string {
    return `
    <div style="text-align: center; font-size: 8px; color: #666;">
        Page {{page}} of {{pages}} - Generated by FinWise AI
    </div>
    `;
  }

  private getReportCSS(): string {
    return `
    body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        line-height: 1.6;
        color: #333;
        margin: 0;
        padding: 0;
    }

    .report-container {
        max-width: 800px;
        margin: 0 auto;
        padding: 20px;
    }

    .report-header {
        text-align: center;
        margin-bottom: 30px;
        border-bottom: 2px solid #2c5aa0;
        padding-bottom: 20px;
    }

    .report-header h1 {
        color: #2c5aa0;
        margin: 0 0 15px 0;
        font-size: 28px;
    }

    .report-info p {
        margin: 5px 0;
        font-size: 14px;
        color: #666;
    }

    .executive-summary {
        margin-bottom: 30px;
    }

    .summary-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 20px;
        margin-top: 20px;
    }

    .summary-item {
        padding: 20px;
        border-radius: 8px;
        text-align: center;
        border: 1px solid #ddd;
    }

    .summary-item.positive {
        background-color: #f0f9f0;
        border-color: #4caf50;
    }

    .summary-item.negative {
        background-color: #fff5f5;
        border-color: #f44336;
    }

    .summary-item h3 {
        margin: 0 0 10px 0;
        font-size: 16px;
        color: #666;
    }

    .summary-item .amount {
        font-size: 24px;
        font-weight: bold;
        margin: 0;
    }

    .positive .amount {
        color: #4caf50;
    }

    .negative .amount {
        color: #f44336;
    }

    .data-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 15px;
    }

    .data-table th,
    .data-table td {
        padding: 12px;
        text-align: left;
        border-bottom: 1px solid #ddd;
    }

    .data-table th {
        background-color: #f5f5f5;
        font-weight: bold;
        color: #333;
    }

    .data-table tr:hover {
        background-color: #f9f9f9;
    }

    .expense {
        color: #f44336;
    }

    .income {
        color: #4caf50;
    }

    .goal-item {
        margin-bottom: 25px;
        padding: 20px;
        border: 1px solid #ddd;
        border-radius: 8px;
        background-color: #fafafa;
    }

    .goal-item h3 {
        margin: 0 0 15px 0;
        color: #2c5aa0;
    }

    .progress-bar {
        width: 100%;
        height: 20px;
        background-color: #e0e0e0;
        border-radius: 10px;
        overflow: hidden;
        margin-bottom: 10px;
    }

    .progress-fill {
        height: 100%;
        background-color: #4caf50;
        transition: width 0.3s ease;
    }

    .progress-text {
        text-align: center;
        font-weight: bold;
        margin: 0 0 15px 0;
    }

    .goal-details p {
        margin: 5px 0;
        font-size: 14px;
    }

    .status-active {
        color: #4caf50;
        font-weight: bold;
    }

    .status-inactive {
        color: #f44336;
        font-weight: bold;
    }

    .trend-increasing {
        color: #f44336;
    }

    .trend-decreasing {
        color: #4caf50;
    }

    .trend-stable {
        color: #666;
    }

    .trend-item {
        margin-bottom: 15px;
        padding: 15px;
        border-left: 4px solid #2c5aa0;
        background-color: #f9f9f9;
    }

    .trend-item h4 {
        margin: 0 0 10px 0;
        color: #2c5aa0;
    }

    .trend-item p {
        margin: 5px 0;
        font-size: 14px;
    }

    .report-footer {
        margin-top: 40px;
        padding-top: 20px;
        border-top: 1px solid #ddd;
        text-align: center;
        font-size: 12px;
        color: #666;
    }

    .watermark {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) rotate(-45deg);
        font-size: 48px;
        color: rgba(0, 0, 0, 0.1);
        z-index: -1;
        pointer-events: none;
    }

    h2 {
        color: #2c5aa0;
        border-bottom: 1px solid #ddd;
        padding-bottom: 10px;
        margin-top: 30px;
        margin-bottom: 20px;
    }

    h3 {
        color: #333;
        margin-top: 20px;
        margin-bottom: 15px;
    }

    @media print {
        .report-container {
            max-width: none;
            margin: 0;
            padding: 0;
        }
        
        .summary-grid {
            grid-template-columns: repeat(4, 1fr);
        }
    }
    `;
  }
}