# Design Document: FinWise AI

## Overview

FinWise AI is a cross-platform mobile application built with React Native that provides AI-powered financial management through real-time transaction detection, intelligent expense categorization, and automated micro-savings. The system combines machine learning algorithms for spending analysis with seamless integrations to Kenyan financial services (M-Pesa, local banks) and global alternatives.

The architecture follows a microservices pattern with a React Native frontend, Node.js backend services, Firebase for real-time data synchronization, and cloud-based ML services for AI processing. The design prioritizes user experience through non-intrusive categorization popups, gamified savings features, and personalized financial storytelling.

## Architecture

### High-Level System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Native  │    │   Node.js API   │    │  ML Services    │
│   Mobile App    │◄──►│   Gateway       │◄──►│  (TensorFlow)   │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Firebase      │    │  External APIs  │    │  Cloud Storage  │
│   Realtime DB   │    │  (M-Pesa, Banks,│    │  (User Data,    │
│                 │    │   Nabo Capital) │    │   ML Models)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Component Architecture

The system is organized into six main components:

1. **Frontend Layer (React Native)**
   - User Interface Components
   - State Management (Redux)
   - Offline Data Caching
   - Biometric Authentication

2. **API Gateway (Node.js/Express)**
   - Request routing and validation
   - Authentication middleware
   - Rate limiting and security
   - API orchestration

3. **Core Services**
   - Transaction Parser Service
   - Categorization Service
   - AI Advisor Service
   - Savings Automation Service

4. **Data Layer**
   - Firebase Realtime Database
   - Encrypted local storage
   - Backup and sync mechanisms

5. **External Integrations**
   - M-Pesa API connector
   - Banking API adapters
   - Nabo Capital integration
   - SMS parsing service

6. **ML/AI Pipeline**
   - Anomaly detection models
   - Spending pattern analysis
   - Recommendation engine
   - Natural language processing

## Components and Interfaces

### Transaction Parser Service

**Purpose**: Detects and parses financial transactions from multiple sources

**Key Methods**:
- `parseSMSTransaction(smsContent: string): Transaction`
- `fetchBankTransactions(accountId: string): Transaction[]`
- `validateTransaction(transaction: Transaction): boolean`

**Data Flow**:
1. SMS received → Parse content → Extract transaction details
2. API polling → Fetch new transactions → Normalize format
3. Validation → Store in database → Trigger categorization popup

### Categorization Popup Component

**Purpose**: Provides immediate, non-intrusive expense categorization interface

**Key Features**:
- Auto-suggestion based on transaction details
- Voice input support with speech-to-text
- Smart category learning from user patterns
- Dismissible with fallback to "Uncategorized"

**Interface**:
```typescript
interface CategorizationPopup {
  showPopup(transaction: Transaction): void;
  getSuggestedCategories(transaction: Transaction): Category[];
  saveUserInput(category: string, description: string): void;
  handleVoiceInput(): Promise<string>;
}
```

### AI Advisor Service

**Purpose**: Provides personalized financial insights using machine learning

**Core Algorithms**:
- **Anomaly Detection**: Isolation Forest algorithm to detect unusual spending
- **Pattern Recognition**: Time series analysis for spending trends
- **Recommendation Engine**: Collaborative filtering with local context
- **Predictive Modeling**: Linear regression for savings forecasting

**Key Methods**:
- `detectSpendingAnomalies(userId: string): Anomaly[]`
- `generatePersonalizedAdvice(spendingData: SpendingData): Advice`
- `predictSavingsGoalProgress(goalId: string): Prediction`

### Savings Automator Service

**Purpose**: Handles automated micro-savings with Nabo Capital integration

**Features**:
- Round-up savings rules
- Percentage-based automatic transfers
- Consistency streak tracking
- Goal-based savings calculations

**Integration Flow**:
1. Transaction detected → Calculate savings amount
2. User confirmation (optional) → Execute transfer to Nabo Capital
3. Track transfer success → Update streak counters
4. Generate gamified feedback

### Money Story Generator

**Purpose**: Creates engaging narratives about spending patterns using NLP

**Components**:
- Template-based story generation
- Sentiment analysis for spending behavior
- Localization for Kenyan context
- Actionable insight integration

**Story Templates**:
- Weekly spending summaries
- Goal progress narratives
- Behavioral change stories
- Achievement celebrations

## Data Models

### Core Data Structures

```typescript
interface User {
  id: string;
  email: string;
  phoneNumber: string;
  country: string;
  currency: string;
  preferences: UserPreferences;
  createdAt: Date;
  lastActive: Date;
}

interface Transaction {
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
}

interface SavingsGoal {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: Date;
  automationRules: AutomationRule[];
  isActive: boolean;
}

interface SpendingPattern {
  userId: string;
  category: string;
  averageMonthly: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  anomalyScore: number;
  lastAnalyzed: Date;
}
```

### Database Schema

**Firebase Collections**:
- `users/` - User profiles and preferences
- `transactions/` - All financial transactions
- `goals/` - Savings goals and progress
- `patterns/` - AI-analyzed spending patterns
- `stories/` - Generated money stories
- `notifications/` - User alerts and advice

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property-Based Testing Overview

Property-based testing validates software correctness by testing universal properties across many generated inputs. Each property is a formal specification that should hold for all valid inputs.

Based on the prework analysis of acceptance criteria, the following properties have been identified for testing:

**Property 1: SMS Transaction Parsing Completeness**
*For any* valid SMS message from supported mobile money providers (M-Pesa, Airtel Money, etc.), the Transaction_Parser should successfully extract transaction amount, recipient, and timestamp
**Validates: Requirements 1.1, 1.4, 10.4**

**Property 2: Transaction API Processing**
*For any* valid bank API transaction response, the Transaction_Parser should capture all transaction details and complete processing within the specified time limit
**Validates: Requirements 1.2**

**Property 3: Error Handling and Fallback**
*For any* malformed or invalid transaction input, the system should log appropriate errors and provide manual entry alternatives
**Validates: Requirements 1.3, 7.4**

**Property 4: Categorization Popup Triggering**
*For any* detected transaction, the Categorization_Popup should appear and provide relevant category suggestions based on transaction details
**Validates: Requirements 2.1, 2.2**

**Property 5: Category Learning and Persistence**
*For any* custom category description entered by a user, the system should save it and include it in future auto-suggestions for similar transactions
**Validates: Requirements 2.3**

**Property 6: Input Method Support**
*For any* categorization popup instance, both text input and voice input methods should be available and functional
**Validates: Requirements 2.4**

**Property 7: Default Categorization Behavior**
*For any* dismissed categorization popup, the transaction should be marked as "Uncategorized" and remain editable
**Validates: Requirements 2.5**

**Property 8: Anomaly Detection Accuracy**
*For any* spending dataset with known anomalous patterns, the Anomaly_Detector should identify the unusual spending behaviors
**Validates: Requirements 3.1**

**Property 9: Notification Generation**
*For any* detected poor spending trend, the AI_Advisor should generate appropriate notifications and advice
**Validates: Requirements 3.2**

**Property 10: Personalized Recommendations**
*For any* user's spending history, the AI_Advisor should generate recommendations that are specific to that user's patterns and context
**Validates: Requirements 3.3, 3.4, 3.5**

**Property 11: Savings Calculation Optimization**
*For any* savings goal configuration, the Savings_Automator should calculate micro-saving amounts that are mathematically optimal for reaching the goal
**Validates: Requirements 4.1**

**Property 12: Savings Offer Generation**
*For any* transaction occurrence, the Savings_Automator should generate appropriate savings transfer offers based on user preferences
**Validates: Requirements 4.2**

**Property 13: Minimum Transfer Handling**
*For any* savings transfer amount (including amounts as small as 50 KES), the system should execute the transfer successfully
**Validates: Requirements 4.3**

**Property 14: Retry Logic and Error Handling**
*For any* failed savings transfer, the system should retry up to 3 times and notify the user of the final outcome
**Validates: Requirements 4.4**

**Property 15: Streak Tracking Accuracy**
*For any* sequence of savings activities, the system should accurately calculate consistency streaks and provide appropriate gamified feedback
**Validates: Requirements 4.5**

**Property 16: Spending Summary Accuracy**
*For any* set of transactions, the system should generate accurate daily, weekly, and monthly spending summaries
**Validates: Requirements 5.1**

**Property 17: Data Visualization Correctness**
*For any* expenditure dataset, the generated pie charts and drill-down data should accurately represent the spending distribution
**Validates: Requirements 5.2**

**Property 18: Trend Analysis Accuracy**
*For any* time-series spending data, the system should correctly identify and report spending trends over time
**Validates: Requirements 5.3**

**Property 19: Milestone Detection**
*For any* savings goal progress, the system should detect when milestones are reached and generate celebratory notifications
**Validates: Requirements 5.4**

**Property 20: Report Export Functionality**
*For any* financial data, the system should generate valid PDF reports that contain all relevant information
**Validates: Requirements 5.5**

**Property 21: Story Generation Completeness**
*For any* user's spending data, the Money_Story should generate coherent narratives that include both positive and negative spending behaviors with actionable suggestions
**Validates: Requirements 6.1, 6.2, 6.4, 6.5**

**Property 22: Story Personalization**
*For any* user context (location, language, spending patterns), the Money_Story should use appropriate personalized language and local context
**Validates: Requirements 6.3**

**Property 23: Data Synchronization Consistency**
*For any* user logged into multiple devices, data changes on one device should be accurately synchronized to all other devices
**Validates: Requirements 8.4**

**Property 24: Offline-Online Sync Integrity**
*For any* data created while offline, the system should sync all changes when connectivity is restored without data loss
**Validates: Requirements 8.5**

**Property 25: Fraud Detection Accuracy**
*For any* transaction dataset containing suspicious patterns, the system should detect and alert users about potential fraudulent transactions
**Validates: Requirements 9.4**

**Property 26: Data Deletion Completeness**
*For any* user data deletion request, the system should permanently remove all associated data from all storage locations
**Validates: Requirements 9.5**

**Property 27: Currency Conversion Accuracy**
*For any* supported currency pair, the system should provide accurate real-time conversion rates and handle multi-currency transactions correctly
**Validates: Requirements 10.1**

**Property 28: Localization Completeness**
*For any* supported locale (especially Kenyan), the system should display appropriate language elements and cultural context
**Validates: Requirements 10.2**

**Property 29: Country-Specific Adaptation**
*For any* supported country, the system should provide appropriate local financial systems and payment method integrations
**Validates: Requirements 10.3**

**Property 30: Service Fallback Reliability**
*For any* unavailable primary service (like M-Pesa), the system should seamlessly switch to appropriate alternative integrations
**Validates: Requirements 10.5**

## Error Handling

### Error Categories and Responses

**Network and API Errors**:
- Connection timeouts: Retry with exponential backoff, fallback to cached data
- API rate limiting: Queue requests and implement respectful retry logic
- Authentication failures: Prompt user re-authentication, maintain session security
- Service unavailability: Switch to alternative providers, enable offline mode

**Data Processing Errors**:
- SMS parsing failures: Log error details, prompt manual transaction entry
- Invalid transaction data: Flag for user review, provide correction interface
- ML model errors: Fallback to rule-based logic, log for model improvement
- Currency conversion failures: Use cached rates, notify user of potential inaccuracy

**User Input Errors**:
- Invalid categorization: Provide suggested corrections, allow custom categories
- Malformed voice input: Offer text input alternative, improve speech recognition
- Incomplete goal setup: Guide user through required fields, provide examples
- Biometric authentication failure: Fallback to PIN/password, maintain security

**System Errors**:
- Database connection issues: Use local storage, sync when connection restored
- Storage quota exceeded: Implement data cleanup, notify user of storage needs
- Memory constraints: Optimize data loading, implement pagination
- Background processing failures: Retry critical tasks, notify user of delays

### Error Recovery Strategies

1. **Graceful Degradation**: Core functionality remains available even when advanced features fail
2. **Automatic Retry**: Implement intelligent retry logic with exponential backoff
3. **User Notification**: Provide clear, actionable error messages in user's language
4. **Fallback Mechanisms**: Always provide alternative paths for critical operations
5. **Error Logging**: Comprehensive logging for debugging while respecting privacy

## Testing Strategy

### Dual Testing Approach

The testing strategy combines two complementary approaches to ensure comprehensive coverage:

**Unit Tests**: Verify specific examples, edge cases, and error conditions
- Focus on individual component behavior
- Test specific examples that demonstrate correct functionality
- Validate error handling and edge cases
- Integration points between components

**Property-Based Tests**: Verify universal properties across all inputs
- Test properties that should hold for all valid inputs
- Use randomized input generation to discover edge cases
- Validate correctness properties defined in this document
- Minimum 100 iterations per property test for statistical confidence

### Property-Based Testing Configuration

**Testing Framework**: Fast-check (JavaScript/TypeScript property-based testing library)
- Integrates well with React Native and Node.js ecosystem
- Supports complex data generation and shrinking
- Provides excellent debugging capabilities for failed properties

**Test Configuration**:
- Minimum 100 iterations per property test
- Custom generators for financial data (transactions, currencies, SMS formats)
- Shrinking enabled to find minimal failing examples
- Timeout configuration for long-running ML tests

**Test Tagging Format**:
Each property-based test must include a comment with the following format:
```javascript
// Feature: finwise-ai-app, Property 1: SMS Transaction Parsing Completeness
```

**Property Test Implementation Requirements**:
- Each correctness property must be implemented as a single property-based test
- Tests should reference the specific property number and description
- Generators should create realistic financial data within valid ranges
- Properties should test the actual implementation, not mocked components

### Testing Coverage Areas

**Core Functionality Testing**:
- Transaction parsing and categorization
- AI-driven spending analysis and recommendations
- Savings automation and goal tracking
- Data synchronization and offline capabilities

**Integration Testing**:
- External API integrations (M-Pesa, banks, Nabo Capital)
- Cross-platform functionality (iOS/Android)
- Real-time data synchronization
- Authentication and security flows

**Performance Testing**:
- ML model inference speed
- Large dataset processing
- Real-time transaction detection
- Memory usage optimization

**Security Testing**:
- Data encryption validation
- Authentication mechanism testing
- API security compliance
- Privacy protection verification

### Test Data Management

**Synthetic Data Generation**:
- Realistic transaction patterns for different user types
- Multi-currency transaction scenarios
- Various SMS formats from different providers
- Spending patterns that trigger anomaly detection

**Privacy-Preserving Testing**:
- No real user data in test environments
- Anonymized patterns for ML model training
- Synthetic user profiles for integration testing
- Compliance with data protection regulations

The testing strategy ensures that FinWise AI delivers reliable, secure, and accurate financial management capabilities while maintaining high code quality and user trust.