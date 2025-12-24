import { Transaction } from '@finwise-ai/shared';
import { logger } from '../utils/logger';

export interface SMSParseResult {
  success: boolean;
  transaction?: Partial<Transaction>;
  error?: string;
  provider?: string;
}

export interface SMSPattern {
  provider: string;
  patterns: RegExp[];
  extractors: {
    amount: (match: RegExpMatchArray) => number;
    recipient: (match: RegExpMatchArray) => string;
    timestamp: (match: RegExpMatchArray) => Date;
    description: (match: RegExpMatchArray) => string;
  };
}

/**
 * SMS Transaction Parser Service
 * Parses transaction SMS messages from various Kenyan mobile money providers
 */
export class SMSTransactionParser {
  private patterns: SMSPattern[] = [
    // M-Pesa patterns
    {
      provider: 'M-Pesa',
      patterns: [
        // Standard M-Pesa send money format
        /([A-Z0-9]+)\s+Confirmed\.\s+You\s+have\s+sent\s+Ksh([\d,]+\.?\d*)\s+to\s+(.+?)\s+on\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+at\s+(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i,
        // M-Pesa receive money format
        /([A-Z0-9]+)\s+Confirmed\.\s+You\s+have\s+received\s+Ksh([\d,]+\.?\d*)\s+from\s+(.+?)\s+on\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+at\s+(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i,
        // M-Pesa pay bill format
        /([A-Z0-9]+)\s+Confirmed\.\s+Ksh([\d,]+\.?\d*)\s+paid\s+to\s+(.+?)\.\s+on\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+at\s+(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i,
        // M-Pesa buy goods format
        /([A-Z0-9]+)\s+Confirmed\.\s+Ksh([\d,]+\.?\d*)\s+paid\s+for\s+(.+?)\s+on\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+at\s+(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i,
      ],
      extractors: {
        amount: (match) => parseFloat(match[2].replace(/,/g, '')),
        recipient: (match) => match[3].trim(),
        timestamp: (match) => this.parseDateTime(match[4], match[5]),
        description: (match) => `${match[1]} - ${match[3]}`,
      },
    },
    // Airtel Money patterns
    {
      provider: 'Airtel Money',
      patterns: [
        // Airtel Money send format
        /Transaction\s+ID:\s*([A-Z0-9]+).*?You\s+have\s+sent\s+KES\s*([\d,]+\.?\d*)\s+to\s+(.+?)\s+on\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(\d{1,2}:\d{2})/i,
        // Airtel Money receive format
        /Transaction\s+ID:\s*([A-Z0-9]+).*?You\s+have\s+received\s+KES\s*([\d,]+\.?\d*)\s+from\s+(.+?)\s+on\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(\d{1,2}:\d{2})/i,
      ],
      extractors: {
        amount: (match) => parseFloat(match[2].replace(/,/g, '')),
        recipient: (match) => match[3].trim(),
        timestamp: (match) => this.parseDateTime(match[4], match[5]),
        description: (match) => `${match[1]} - ${match[3]}`,
      },
    },
    // Equitel patterns
    {
      provider: 'Equitel',
      patterns: [
        // Equitel send format
        /Dear\s+Customer,\s+You\s+have\s+sent\s+KSh\s*([\d,]+\.?\d*)\s+to\s+(.+?)\s+Ref:\s*([A-Z0-9]+)\s+on\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+at\s+(\d{1,2}:\d{2})/i,
        // Equitel receive format
        /Dear\s+Customer,\s+You\s+have\s+received\s+KSh\s*([\d,]+\.?\d*)\s+from\s+(.+?)\s+Ref:\s*([A-Z0-9]+)\s+on\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+at\s+(\d{1,2}:\d{2})/i,
      ],
      extractors: {
        amount: (match) => parseFloat(match[1].replace(/,/g, '')),
        recipient: (match) => match[2].trim(),
        timestamp: (match) => this.parseDateTime(match[4], match[5]),
        description: (match) => `${match[3]} - ${match[2]}`,
      },
    },
    // T-Kash patterns
    {
      provider: 'T-Kash',
      patterns: [
        // T-Kash send format
        /T-Kash\s+Transaction\s+([A-Z0-9]+):\s+You\s+sent\s+KES\s*([\d,]+\.?\d*)\s+to\s+(.+?)\s+on\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(\d{1,2}:\d{2})/i,
        // T-Kash receive format
        /T-Kash\s+Transaction\s+([A-Z0-9]+):\s+You\s+received\s+KES\s*([\d,]+\.?\d*)\s+from\s+(.+?)\s+on\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(\d{1,2}:\d{2})/i,
      ],
      extractors: {
        amount: (match) => parseFloat(match[2].replace(/,/g, '')),
        recipient: (match) => match[3].trim(),
        timestamp: (match) => this.parseDateTime(match[4], match[5]),
        description: (match) => `${match[1]} - ${match[3]}`,
      },
    },
  ];

  /**
   * Parse SMS message and extract transaction details
   */
  public parseSMS(smsContent: string, phoneNumber?: string): SMSParseResult {
    try {
      // Clean and normalize SMS content
      const cleanedSMS = this.cleanSMSContent(smsContent);
      
      logger.info('Parsing SMS transaction', { 
        smsLength: cleanedSMS.length,
        phoneNumber: phoneNumber ? this.maskPhoneNumber(phoneNumber) : 'unknown'
      });

      // Try each provider pattern
      for (const pattern of this.patterns) {
        for (const regex of pattern.patterns) {
          const match = cleanedSMS.match(regex);
          if (match) {
            try {
              const transaction = this.extractTransactionData(match, pattern);
              
              logger.info('Successfully parsed SMS transaction', {
                provider: pattern.provider,
                amount: transaction.amount,
                merchant: transaction.merchant
              });

              return {
                success: true,
                transaction,
                provider: pattern.provider,
              };
            } catch (extractError) {
              logger.warn('Failed to extract transaction data', {
                provider: pattern.provider,
                error: extractError instanceof Error ? extractError.message : 'Unknown error'
              });
              continue;
            }
          }
        }
      }

      // No pattern matched
      logger.warn('No SMS pattern matched', { smsContent: cleanedSMS.substring(0, 100) });
      return {
        success: false,
        error: 'SMS format not recognized',
      };

    } catch (error) {
      logger.error('SMS parsing failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        smsContent: smsContent.substring(0, 100)
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown parsing error',
      };
    }
  }

  /**
   * Extract transaction data using pattern extractors
   */
  private extractTransactionData(match: RegExpMatchArray, pattern: SMSPattern): Partial<Transaction> {
    const amount = pattern.extractors.amount(match);
    const recipient = pattern.extractors.recipient(match);
    const timestamp = pattern.extractors.timestamp(match);
    const description = pattern.extractors.description(match);

    // Validate extracted data
    if (isNaN(amount) || amount <= 0) {
      throw new Error('Invalid transaction amount');
    }

    if (!recipient || recipient.trim().length === 0) {
      throw new Error('Invalid recipient');
    }

    if (!timestamp || isNaN(timestamp.getTime())) {
      throw new Error('Invalid timestamp');
    }

    return {
      amount,
      currency: 'KES', // Default to Kenyan Shillings
      description,
      timestamp,
      source: 'sms' as const,
      rawData: match[0],
      isVerified: false,
      merchant: recipient,
    };
  }

  /**
   * Clean and normalize SMS content
   */
  private cleanSMSContent(smsContent: string): string {
    return smsContent
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[\r\n]+/g, ' ') // Remove line breaks
      .trim();
  }

  /**
   * Parse date and time from SMS
   */
  private parseDateTime(dateStr: string, timeStr: string): Date {
    try {
      // Handle different date formats
      const dateParts = dateStr.split('/');
      let day: number, month: number, year: number;

      if (dateParts.length === 3) {
        day = parseInt(dateParts[0], 10);
        month = parseInt(dateParts[1], 10) - 1; // JavaScript months are 0-indexed
        year = parseInt(dateParts[2], 10);

        // Handle 2-digit years
        if (year < 100) {
          year += year < 50 ? 2000 : 1900;
        }
      } else {
        throw new Error('Invalid date format');
      }

      // Parse time
      const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
      if (!timeMatch) {
        throw new Error('Invalid time format');
      }

      let hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);
      const ampm = timeMatch[3];

      // Handle 12-hour format
      if (ampm) {
        if (ampm.toUpperCase() === 'PM' && hours !== 12) {
          hours += 12;
        } else if (ampm.toUpperCase() === 'AM' && hours === 12) {
          hours = 0;
        }
      }

      const date = new Date(year, month, day, hours, minutes);
      
      if (isNaN(date.getTime())) {
        throw new Error('Invalid date/time combination');
      }

      return date;
    } catch (error) {
      logger.warn('Date parsing failed, using current time', {
        dateStr,
        timeStr,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return new Date(); // Fallback to current time
    }
  }

  /**
   * Mask phone number for logging
   */
  private maskPhoneNumber(phoneNumber: string): string {
    if (phoneNumber.length <= 4) return phoneNumber;
    return phoneNumber.substring(0, 3) + '***' + phoneNumber.substring(phoneNumber.length - 2);
  }

  /**
   * Get supported providers
   */
  public getSupportedProviders(): string[] {
    return this.patterns.map(pattern => pattern.provider);
  }

  /**
   * Test if SMS content matches any known pattern
   */
  public isTransactionSMS(smsContent: string): boolean {
    const cleanedSMS = this.cleanSMSContent(smsContent);
    
    return this.patterns.some(pattern =>
      pattern.patterns.some(regex => regex.test(cleanedSMS))
    );
  }
}

// Export singleton instance
export const smsParser = new SMSTransactionParser();