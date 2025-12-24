import { PDFExportService, FinancialReportData, PDFExportOptions } from '../services/pdfExportService';
import { User, Transaction, SavingsGoal, SpendingPattern } from '@finwise-ai/shared';

// Mock html-pdf-node
jest.mock('html-pdf-node', () => ({
  generatePdf: jest.fn().mockResolvedValue(Buffer.from('mock-pdf-content'))
}));

describe('PDFExportService', () => {
  let pdfExportService: PDFExportService;

  const mockUser: User = {
    id: 'user123',
    email: 'test@example.com',
    phoneNumber: '+254700000000',
    country: 'KE',
    currency: 'KES',
    preferences: {
      language: 'en',
      notifications: {
        spendingAlerts: true,
        savingsReminders: true,
        goalMilestones: true,
        weeklyReports: false
      },
      savingsAutomation: {
        enabled: true,
        roundUpSavings: true,
        percentageSavings: 10,
        minimumTransfer: 50,
        autoTransfer: true
      },
      categories: []
    },
    createdAt: new Date('2024-01-01'),
    lastActive: new Date()
  };

  const mockTransactions: Transaction[] = [
    {
      id: 'tx1',
      userId: 'user123',
      amount: 1500,
      currency: 'KES',
      description: 'Grocery shopping',
      category: 'Food',
      subcategory: 'Groceries',
      timestamp: new Date('2024-01-15'),
      source: 'sms',
      rawData: 'SMS content',
      isVerified: true
    },
    {
      id: 'tx2',
      userId: 'user123',
      amount: -5000,
      currency: 'KES',
      description: 'Salary deposit',
      category: 'Income',
      timestamp: new Date('2024-01-01'),
      source: 'api',
      rawData: 'API response',
      isVerified: true
    }
  ];

  const mockSavingsGoals: SavingsGoal[] = [
    {
      id: 'goal1',
      userId: 'user123',
      name: 'Emergency Fund',
      targetAmount: 100000,
      currentAmount: 25000,
      deadline: new Date('2024-12-31'),
      automationRules: [],
      isActive: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date()
    }
  ];

  const mockSpendingPatterns: SpendingPattern[] = [
    {
      userId: 'user123',
      category: 'Food',
      averageMonthly: 8000,
      trend: 'stable',
      anomalyScore: 0.1,
      lastAnalyzed: new Date(),
      confidence: 0.9
    }
  ];

  const mockReportData: FinancialReportData = {
    user: mockUser,
    reportPeriod: {
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
      type: 'monthly'
    },
    transactions: mockTransactions,
    spendingPatterns: mockSpendingPatterns,
    savingsGoals: mockSavingsGoals,
    summary: {
      totalIncome: 5000,
      totalExpenses: 1500,
      totalSavings: 25000,
      netCashFlow: 3500,
      topSpendingCategories: [
        { category: 'Food', amount: 1500, percentage: 100 }
      ]
    }
  };

  beforeEach(() => {
    pdfExportService = new PDFExportService();
  });

  describe('validateReportData', () => {
    it('should validate complete report data as valid', () => {
      const validation = pdfExportService.validateReportData(mockReportData);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing user information', () => {
      const invalidData = { ...mockReportData, user: null as any };
      const validation = pdfExportService.validateReportData(invalidData);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('User information is required');
    });

    it('should detect missing report period', () => {
      const invalidData = { ...mockReportData, reportPeriod: null as any };
      const validation = pdfExportService.validateReportData(invalidData);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Report period with start and end dates is required');
    });

    it('should detect missing summary data', () => {
      const invalidData = { ...mockReportData, summary: null as any };
      const validation = pdfExportService.validateReportData(invalidData);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Financial summary data is required');
    });

    it('should detect invalid transactions array', () => {
      const invalidData = { ...mockReportData, transactions: null as any };
      const validation = pdfExportService.validateReportData(invalidData);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Transactions array is required');
    });

    it('should detect multiple validation errors', () => {
      const invalidData = {
        ...mockReportData,
        user: null as any,
        summary: null as any
      };
      const validation = pdfExportService.validateReportData(invalidData);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(1);
    });
  });

  describe('generateFinancialReport', () => {
    it('should generate PDF with default options', async () => {
      const pdfBuffer = await pdfExportService.generateFinancialReport(mockReportData);

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
    });

    it('should generate PDF with custom options', async () => {
      const customOptions: Partial<PDFExportOptions> = {
        format: 'Letter',
        orientation: 'landscape',
        includeCharts: false,
        includeTransactionDetails: false
      };

      const pdfBuffer = await pdfExportService.generateFinancialReport(mockReportData, customOptions);

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
    });

    it('should handle PDF generation errors', async () => {
      const htmlPdf = require('html-pdf-node');
      htmlPdf.generatePdf.mockRejectedValueOnce(new Error('PDF generation failed'));

      await expect(
        pdfExportService.generateFinancialReport(mockReportData)
      ).rejects.toThrow('PDF generation failed');
    });

    it('should include watermark when specified', async () => {
      const optionsWithWatermark: Partial<PDFExportOptions> = {
        watermark: 'CONFIDENTIAL'
      };

      const pdfBuffer = await pdfExportService.generateFinancialReport(mockReportData, optionsWithWatermark);

      expect(pdfBuffer).toBeInstanceOf(Buffer);
    });
  });

  describe('generateSavingsGoalReport', () => {
    it('should generate savings goal PDF report', async () => {
      const pdfBuffer = await pdfExportService.generateSavingsGoalReport(
        mockUser,
        mockSavingsGoals
      );

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
    });

    it('should generate savings goal report with custom options', async () => {
      const customOptions: Partial<PDFExportOptions> = {
        format: 'A4',
        orientation: 'portrait'
      };

      const pdfBuffer = await pdfExportService.generateSavingsGoalReport(
        mockUser,
        mockSavingsGoals,
        customOptions
      );

      expect(pdfBuffer).toBeInstanceOf(Buffer);
    });

    it('should handle empty goals array', async () => {
      const pdfBuffer = await pdfExportService.generateSavingsGoalReport(
        mockUser,
        []
      );

      expect(pdfBuffer).toBeInstanceOf(Buffer);
    });
  });

  describe('generateSpendingAnalysisReport', () => {
    it('should generate spending analysis PDF report', async () => {
      const pdfBuffer = await pdfExportService.generateSpendingAnalysisReport(
        mockUser,
        mockTransactions,
        mockSpendingPatterns
      );

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
    });

    it('should generate spending analysis with custom options', async () => {
      const customOptions: Partial<PDFExportOptions> = {
        includeTransactionDetails: true,
        includeSpendingAnalysis: true
      };

      const pdfBuffer = await pdfExportService.generateSpendingAnalysisReport(
        mockUser,
        mockTransactions,
        mockSpendingPatterns,
        customOptions
      );

      expect(pdfBuffer).toBeInstanceOf(Buffer);
    });

    it('should handle empty transactions and patterns', async () => {
      const pdfBuffer = await pdfExportService.generateSpendingAnalysisReport(
        mockUser,
        [],
        []
      );

      expect(pdfBuffer).toBeInstanceOf(Buffer);
    });
  });

  describe('PDF content validation', () => {
    it('should include user information in financial report', async () => {
      const htmlPdf = require('html-pdf-node');
      let capturedHtml = '';
      
      htmlPdf.generatePdf.mockImplementationOnce((file: any) => {
        capturedHtml = file.content;
        return Promise.resolve(Buffer.from('mock-pdf'));
      });

      await pdfExportService.generateFinancialReport(mockReportData);

      expect(capturedHtml).toContain(mockUser.email);
      expect(capturedHtml).toContain('FinWise AI Financial Report');
    });

    it('should include transaction details when enabled', async () => {
      const htmlPdf = require('html-pdf-node');
      let capturedHtml = '';
      
      htmlPdf.generatePdf.mockImplementationOnce((file: any) => {
        capturedHtml = file.content;
        return Promise.resolve(Buffer.from('mock-pdf'));
      });

      const options: Partial<PDFExportOptions> = {
        includeTransactionDetails: true
      };

      await pdfExportService.generateFinancialReport(mockReportData, options);

      expect(capturedHtml).toContain('Recent Transactions');
      expect(capturedHtml).toContain('Grocery shopping');
    });

    it('should include savings goals when enabled', async () => {
      const htmlPdf = require('html-pdf-node');
      let capturedHtml = '';
      
      htmlPdf.generatePdf.mockImplementationOnce((file: any) => {
        capturedHtml = file.content;
        return Promise.resolve(Buffer.from('mock-pdf'));
      });

      const options: Partial<PDFExportOptions> = {
        includeSavingsGoals: true
      };

      await pdfExportService.generateFinancialReport(mockReportData, options);

      expect(capturedHtml).toContain('Savings Goals Progress');
      expect(capturedHtml).toContain('Emergency Fund');
    });

    it('should format currency correctly', async () => {
      const htmlPdf = require('html-pdf-node');
      let capturedHtml = '';
      
      htmlPdf.generatePdf.mockImplementationOnce((file: any) => {
        capturedHtml = file.content;
        return Promise.resolve(Buffer.from('mock-pdf'));
      });

      await pdfExportService.generateFinancialReport(mockReportData);

      expect(capturedHtml).toContain('KES');
      expect(capturedHtml).toContain('5,000.00'); // Formatted income
      expect(capturedHtml).toContain('1,500.00'); // Formatted expenses
    });
  });

  describe('error handling', () => {
    it('should handle HTML generation errors gracefully', async () => {
      // Mock a scenario where HTML generation fails by providing invalid data
      const invalidReportData = {
        ...mockReportData,
        user: null as any // This should cause validation to fail
      };

      // The service should validate and reject invalid data
      const validation = pdfExportService.validateReportData(invalidReportData);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should handle PDF generation timeout', async () => {
      const htmlPdf = require('html-pdf-node');
      htmlPdf.generatePdf.mockImplementationOnce(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout')), 100);
        });
      });

      await expect(
        pdfExportService.generateFinancialReport(mockReportData)
      ).rejects.toThrow('Timeout');
    });
  });
});