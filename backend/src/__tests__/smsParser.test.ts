import { SMSTransactionParser } from '../services/smsParser';

describe('SMSTransactionParser', () => {
  let parser: SMSTransactionParser;

  beforeEach(() => {
    parser = new SMSTransactionParser();
  });

  describe('M-Pesa SMS Parsing', () => {
    it('should parse M-Pesa send money SMS correctly', () => {
      const sms = 'QH12ABC123 Confirmed. You have sent Ksh1,500.00 to JOHN DOE on 15/12/23 at 2:30 PM';
      const result = parser.parseSMS(sms);

      expect(result.success).toBe(true);
      expect(result.transaction).toBeDefined();
      expect(result.transaction!.amount).toBe(1500);
      expect(result.transaction!.currency).toBe('KES');
      expect(result.transaction!.merchant).toBe('JOHN DOE');
      expect(result.provider).toBe('M-Pesa');
    });

    it('should parse M-Pesa receive money SMS correctly', () => {
      const sms = 'QH12DEF456 Confirmed. You have received Ksh2,000.50 from JANE SMITH on 16/12/23 at 10:15 AM';
      const result = parser.parseSMS(sms);

      expect(result.success).toBe(true);
      expect(result.transaction).toBeDefined();
      expect(result.transaction!.amount).toBe(2000.50);
      expect(result.transaction!.currency).toBe('KES');
      expect(result.transaction!.merchant).toBe('JANE SMITH');
      expect(result.provider).toBe('M-Pesa');
    });

    it('should parse M-Pesa pay bill SMS correctly', () => {
      const sms = 'QH12GHI789 Confirmed. Ksh500.00 paid to KPLC PREPAID. on 17/12/23 at 8:45 AM';
      const result = parser.parseSMS(sms);

      expect(result.success).toBe(true);
      expect(result.transaction).toBeDefined();
      expect(result.transaction!.amount).toBe(500);
      expect(result.transaction!.merchant).toBe('KPLC PREPAID'); // Remove the trailing dot
      expect(result.provider).toBe('M-Pesa');
    });

    it('should parse M-Pesa buy goods SMS correctly', () => {
      const sms = 'QH12JKL012 Confirmed. Ksh750.25 paid for SUPERMARKET GOODS on 18/12/23 at 6:20 PM';
      const result = parser.parseSMS(sms);

      expect(result.success).toBe(true);
      expect(result.transaction).toBeDefined();
      expect(result.transaction!.amount).toBe(750.25);
      expect(result.transaction!.merchant).toBe('SUPERMARKET GOODS');
      expect(result.provider).toBe('M-Pesa');
    });
  });

  describe('Airtel Money SMS Parsing', () => {
    it('should parse Airtel Money send SMS correctly', () => {
      const sms = 'Transaction ID: AM123456 You have sent KES 1,200.00 to PETER KAMAU on 15/12/23 14:30';
      const result = parser.parseSMS(sms);

      expect(result.success).toBe(true);
      expect(result.transaction).toBeDefined();
      expect(result.transaction!.amount).toBe(1200);
      expect(result.transaction!.currency).toBe('KES');
      expect(result.transaction!.merchant).toBe('PETER KAMAU');
      expect(result.provider).toBe('Airtel Money');
    });

    it('should parse Airtel Money receive SMS correctly', () => {
      const sms = 'Transaction ID: AM789012 You have received KES 800.50 from MARY WANJIKU on 16/12/23 09:15';
      const result = parser.parseSMS(sms);

      expect(result.success).toBe(true);
      expect(result.transaction).toBeDefined();
      expect(result.transaction!.amount).toBe(800.50);
      expect(result.transaction!.merchant).toBe('MARY WANJIKU');
      expect(result.provider).toBe('Airtel Money');
    });
  });

  describe('Equitel SMS Parsing', () => {
    it('should parse Equitel send SMS correctly', () => {
      const sms = 'Dear Customer, You have sent KSh 600.00 to SAMUEL KIPROTICH Ref: EQ345678 on 17/12/23 at 11:45';
      const result = parser.parseSMS(sms);

      expect(result.success).toBe(true);
      expect(result.transaction).toBeDefined();
      expect(result.transaction!.amount).toBe(600);
      expect(result.transaction!.merchant).toBe('SAMUEL KIPROTICH');
      expect(result.provider).toBe('Equitel');
    });

    it('should parse Equitel receive SMS correctly', () => {
      const sms = 'Dear Customer, You have received KSh 1,100.75 from GRACE MUTHONI Ref: EQ901234 on 18/12/23 at 16:20';
      const result = parser.parseSMS(sms);

      expect(result.success).toBe(true);
      expect(result.transaction).toBeDefined();
      expect(result.transaction!.amount).toBe(1100.75);
      expect(result.transaction!.merchant).toBe('GRACE MUTHONI');
      expect(result.provider).toBe('Equitel');
    });
  });

  describe('T-Kash SMS Parsing', () => {
    it('should parse T-Kash send SMS correctly', () => {
      const sms = 'T-Kash Transaction TK567890: You sent KES 450.00 to DAVID MWANGI on 19/12/23 13:10';
      const result = parser.parseSMS(sms);

      expect(result.success).toBe(true);
      expect(result.transaction).toBeDefined();
      expect(result.transaction!.amount).toBe(450);
      expect(result.transaction!.merchant).toBe('DAVID MWANGI');
      expect(result.provider).toBe('T-Kash');
    });

    it('should parse T-Kash receive SMS correctly', () => {
      const sms = 'T-Kash Transaction TK123789: You received KES 925.50 from ESTHER NJERI on 20/12/23 07:30';
      const result = parser.parseSMS(sms);

      expect(result.success).toBe(true);
      expect(result.transaction).toBeDefined();
      expect(result.transaction!.amount).toBe(925.50);
      expect(result.transaction!.merchant).toBe('ESTHER NJERI');
      expect(result.provider).toBe('T-Kash');
    });
  });

  describe('Error Handling', () => {
    it('should handle unrecognized SMS format', () => {
      const sms = 'This is not a transaction SMS';
      const result = parser.parseSMS(sms);

      expect(result.success).toBe(false);
      expect(result.error).toBe('SMS format not recognized');
      expect(result.transaction).toBeUndefined();
    });

    it('should handle empty SMS content', () => {
      const sms = '';
      const result = parser.parseSMS(sms);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle malformed amount in SMS', () => {
      const sms = 'QH12ABC123 Confirmed. You have sent Ksh INVALID to JOHN DOE on 15/12/23 at 2:30 PM';
      const result = parser.parseSMS(sms);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle invalid date format', () => {
      const sms = 'QH12ABC123 Confirmed. You have sent Ksh1,500.00 to JOHN DOE on INVALID_DATE at 2:30 PM';
      const result = parser.parseSMS(sms);

      // Should fail because the entire SMS doesn't match the pattern with invalid date
      expect(result.success).toBe(false);
      expect(result.error).toBe('SMS format not recognized');
    });
  });

  describe('Utility Methods', () => {
    it('should identify transaction SMS correctly', () => {
      const transactionSMS = 'QH12ABC123 Confirmed. You have sent Ksh1,500.00 to JOHN DOE on 15/12/23 at 2:30 PM';
      const nonTransactionSMS = 'Hello, how are you today?';

      expect(parser.isTransactionSMS(transactionSMS)).toBe(true);
      expect(parser.isTransactionSMS(nonTransactionSMS)).toBe(false);
    });

    it('should return supported providers', () => {
      const providers = parser.getSupportedProviders();
      
      expect(providers).toContain('M-Pesa');
      expect(providers).toContain('Airtel Money');
      expect(providers).toContain('Equitel');
      expect(providers).toContain('T-Kash');
      expect(providers.length).toBe(4);
    });
  });

  describe('SMS Content Normalization', () => {
    it('should handle SMS with extra whitespace', () => {
      const sms = '  QH12ABC123   Confirmed.   You have sent   Ksh1,500.00   to   JOHN DOE   on   15/12/23   at   2:30 PM  ';
      const result = parser.parseSMS(sms);

      expect(result.success).toBe(true);
      expect(result.transaction!.amount).toBe(1500);
      expect(result.transaction!.merchant).toBe('JOHN DOE');
    });

    it('should handle SMS with line breaks', () => {
      const sms = 'QH12ABC123 Confirmed.\nYou have sent Ksh1,500.00\nto JOHN DOE on 15/12/23\nat 2:30 PM';
      const result = parser.parseSMS(sms);

      expect(result.success).toBe(true);
      expect(result.transaction!.amount).toBe(1500);
      expect(result.transaction!.merchant).toBe('JOHN DOE');
    });
  });

  describe('Amount Parsing', () => {
    it('should parse amounts with commas correctly', () => {
      const sms = 'QH12ABC123 Confirmed. You have sent Ksh10,500.75 to JOHN DOE on 15/12/23 at 2:30 PM';
      const result = parser.parseSMS(sms);

      expect(result.success).toBe(true);
      expect(result.transaction!.amount).toBe(10500.75);
    });

    it('should parse whole number amounts correctly', () => {
      const sms = 'QH12ABC123 Confirmed. You have sent Ksh1500 to JOHN DOE on 15/12/23 at 2:30 PM';
      const result = parser.parseSMS(sms);

      expect(result.success).toBe(true);
      expect(result.transaction!.amount).toBe(1500);
    });

    it('should handle zero amounts', () => {
      const sms = 'QH12ABC123 Confirmed. You have sent Ksh0.00 to JOHN DOE on 15/12/23 at 2:30 PM';
      const result = parser.parseSMS(sms);

      expect(result.success).toBe(false);
      expect(result.error).toBe('SMS format not recognized'); // The pattern doesn't match because extraction fails
    });
  });

  describe('Date and Time Parsing', () => {
    it('should parse 12-hour time format correctly', () => {
      const sms = 'QH12ABC123 Confirmed. You have sent Ksh1,500.00 to JOHN DOE on 15/12/23 at 2:30 PM';
      const result = parser.parseSMS(sms);

      expect(result.success).toBe(true);
      expect(result.transaction).toBeDefined();
      expect(result.transaction!.timestamp).toBeDefined();
      expect(result.transaction!.timestamp!.getHours()).toBe(14); // 2 PM in 24-hour format
      expect(result.transaction!.timestamp!.getMinutes()).toBe(30);
    });

    it('should parse 24-hour time format correctly', () => {
      const sms = 'Transaction ID: AM123456 You have sent KES 1,200.00 to PETER KAMAU on 15/12/23 14:30';
      const result = parser.parseSMS(sms);

      expect(result.success).toBe(true);
      expect(result.transaction).toBeDefined();
      expect(result.transaction!.timestamp).toBeDefined();
      expect(result.transaction!.timestamp!.getHours()).toBe(14);
      expect(result.transaction!.timestamp!.getMinutes()).toBe(30);
    });

    it('should handle 2-digit years correctly', () => {
      const sms = 'QH12ABC123 Confirmed. You have sent Ksh1,500.00 to JOHN DOE on 15/12/23 at 2:30 PM';
      const result = parser.parseSMS(sms);

      expect(result.success).toBe(true);
      expect(result.transaction).toBeDefined();
      expect(result.transaction!.timestamp).toBeDefined();
      expect(result.transaction!.timestamp!.getFullYear()).toBe(2023);
    });

    it('should handle 4-digit years correctly', () => {
      const sms = 'QH12ABC123 Confirmed. You have sent Ksh1,500.00 to JOHN DOE on 15/12/2023 at 2:30 PM';
      const result = parser.parseSMS(sms);

      expect(result.success).toBe(true);
      expect(result.transaction).toBeDefined();
      expect(result.transaction!.timestamp).toBeDefined();
      expect(result.transaction!.timestamp!.getFullYear()).toBe(2023);
    });
  });
});