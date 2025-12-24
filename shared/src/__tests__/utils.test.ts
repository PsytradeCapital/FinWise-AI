import {
  formatCurrency,
  formatDate,
  generateId,
  validateEmail,
  validatePhoneNumber,
  sanitizeString,
  calculatePercentage,
  validateUser,
  validateTransaction,
  validateSavingsGoal,
  normalizeTransaction,
  normalizeUser,
} from '../utils';

describe('Utility Functions', () => {
  describe('formatCurrency', () => {
    it('should format currency correctly', () => {
      expect(formatCurrency(1000, 'USD')).toBe('$1,000.00');
      // KES formatting may vary by system, so let's check it contains the right elements
      const kesFormatted = formatCurrency(50.5, 'KES');
      expect(kesFormatted).toContain('KES');
      expect(kesFormatted).toContain('50.50');
    });
  });

  describe('formatDate', () => {
    it('should format date correctly', () => {
      const date = new Date('2023-12-01T10:30:00Z');
      const formatted = formatDate(date);
      expect(formatted).toContain('Dec');
      expect(formatted).toContain('2023');
    });
  });

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(id1.length).toBeGreaterThan(0);
    });
  });

  describe('validateEmail', () => {
    it('should validate email addresses correctly', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name+tag@domain.co.uk')).toBe(true);
      expect(validateEmail('invalid-email')).toBe(false);
      expect(validateEmail('test@')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
    });
  });

  describe('validatePhoneNumber', () => {
    it('should validate phone numbers correctly', () => {
      expect(validatePhoneNumber('+254712345678')).toBe(true);
      expect(validatePhoneNumber('0712345678')).toBe(true);
      expect(validatePhoneNumber('(555) 123-4567')).toBe(true);
      expect(validatePhoneNumber('123')).toBe(false);
      expect(validatePhoneNumber('abc123')).toBe(false);
    });
  });

  describe('sanitizeString', () => {
    it('should sanitize strings correctly', () => {
      expect(sanitizeString('  hello world  ')).toBe('hello world');
      expect(sanitizeString('test<script>alert("xss")</script>')).toBe('testscriptalert("xss")/script');
      expect(sanitizeString('normal text')).toBe('normal text');
    });
  });

  describe('calculatePercentage', () => {
    it('should calculate percentages correctly', () => {
      expect(calculatePercentage(25, 100)).toBe(25);
      expect(calculatePercentage(1, 3)).toBe(33.33);
      expect(calculatePercentage(0, 100)).toBe(0);
      expect(calculatePercentage(100, 0)).toBe(0);
    });
  });

  describe('validateUser', () => {
    it('should validate user objects correctly', () => {
      const validUser = {
        email: 'test@example.com',
        phoneNumber: '+254712345678',
        country: 'KE',
        currency: 'KES'
      };
      
      const result = validateUser(validUser);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for invalid user', () => {
      const invalidUser = {
        email: 'invalid-email',
        phoneNumber: '123',
        country: 'INVALID',
        currency: 'INVALID'
      };
      
      const result = validateUser(invalidUser);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateTransaction', () => {
    it('should validate transaction objects correctly', () => {
      const validTransaction = {
        userId: 'user123',
        amount: 100.50,
        currency: 'KES',
        description: 'Test transaction',
        source: 'manual' as const,
        timestamp: new Date()
      };
      
      const result = validateTransaction(validTransaction);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('normalizeTransaction', () => {
    it('should normalize transaction data correctly', () => {
      const rawTransaction = {
        amount: '100.50',
        currency: 'kes',
        description: '  Test Transaction  ',
        userId: 'user123'
      };
      
      const normalized = normalizeTransaction(rawTransaction);
      expect(normalized.amount).toBe(100.50);
      expect(normalized.currency).toBe('KES');
      expect(normalized.description).toBe('Test Transaction');
    });
  });
});