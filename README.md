# FinWise AI

AI-powered mobile financial management application designed to help users overcome poor financial decisions through real-time expense tracking, automated savings, and personalized AI-driven financial advice.

## Project Structure

```
finwise-ai/
├── frontend/          # React Native mobile application
├── backend/           # Node.js API server
├── shared/            # Shared types and utilities
├── docs/              # Documentation
└── .kiro/             # Kiro specifications
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- React Native CLI
- Android Studio (for Android development)
- Xcode (for iOS development, macOS only)
- Firebase account

### Installation

1. Clone the repository
2. Install root dependencies: `npm install`
3. Install backend dependencies: `cd backend && npm install`
4. Install frontend dependencies: `cd frontend && npm install`

### Development

- Start both frontend and backend: `npm run dev`
- Start backend only: `npm run dev:backend`
- Start frontend only: `npm run dev:frontend`

### Testing

- Run all tests: `npm test`
- Run backend tests: `npm run test:backend`
- Run frontend tests: `npm run test:frontend`

### Code Quality

- Lint code: `npm run lint`
- Format code: `npm run format`

## Features

- Real-time transaction detection from SMS and banking APIs
- AI-powered spending analysis and anomaly detection
- Automated micro-savings with Nabo Capital integration
- User-guided expense categorization
- Financial progress tracking and reporting
- Money story narratives
- Cross-platform mobile support (iOS/Android)
- Multi-currency and localization support

## Architecture

The application follows a microservices architecture with:
- React Native frontend for cross-platform mobile experience
- Node.js/Express backend API
- Firebase for real-time data synchronization
- TensorFlow for AI/ML capabilities
- External integrations (M-Pesa, banking APIs, Nabo Capital)

## Requirements

See `.kiro/specs/finwise-ai-app/requirements.md` for detailed requirements.

## Design

See `.kiro/specs/finwise-ai-app/design.md` for system design and architecture.

## Implementation Plan

See `.kiro/specs/finwise-ai-app/tasks.md` for the complete implementation roadmap.