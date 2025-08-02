# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js spreadsheet application with AI chat integration, built using TypeScript, React, and Tailwind CSS. The app provides a Google Sheets-like interface with AI assistance powered by Anthropic's Claude API for data analysis and manipulation.

## Development Commands

```bash
# Install dependencies
pnpm install

# Development server (starts on http://localhost:3000)
pnpm dev

# Production build
pnpm build

# Start production server
pnpm start

# Lint code
pnpm lint
```

## Architecture Overview

### Core Data Flow
- **Workbook Management**: Centralized through `hooks/use-workbook.ts` with undo/redo functionality via `hooks/use-workbook-history.ts`
- **State Management**: UI state handled by Zustand store in `state/ui-store.ts` with persistence
- **AI Integration**: Chat functionality managed through `hooks/use-chat-messages.ts` connecting to `/api/chat.ts`

### Key Components Structure
- **Main View**: `components/features/spreadsheet-view.tsx` - Main spreadsheet interface
- **AI Chat**: `components/features/ai-chat-panel.tsx` - Resizable chat panel for AI interactions
- **Layout Components**: 
  - `components/layout/grid-container.tsx` - Spreadsheet grid
  - `components/layout/toolbar.tsx` - Top toolbar
  - `components/layout/formula-bar.tsx` - Formula input bar
  - `components/layout/sheet-tabs.tsx` - Sheet navigation tabs

### Data Models
- **Workbook**: `types/workbook.ts` defines Sheet and Workbook interfaces
- **Chat Messages**: Support for user, AI, status, and table message types

### AI Tools Integration
- **Spreadsheet Tools**: `api/_lib/tools/spreadsheet-tools.ts` - Cell manipulation, formula application
- **Agent System**: `api/_lib/agent.ts` - Tool execution handler

## Technical Stack

- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS with shadcn/ui components
- **State**: Zustand for UI state, React hooks for workbook state
- **AI**: Anthropic Claude API via Vercel AI SDK
- **Data**: Local storage persistence, Excel file support via `xlsx` library
- **Icons**: Lucide React

## Development Notes

- Uses `@/*` path aliases for clean imports
- Workbook data persists to localStorage automatically
- Chat panel is resizable and its state persists
- AI tools can manipulate spreadsheet data
- TypeScript strict mode enabled
- ESLint and TypeScript errors ignored during builds (configured in next.config.mjs)

## File Import/Export

The application supports Excel file operations through the `xlsx` library and includes CSV parsing via `papaparse`. Mock data is available in `api/mock-data.ts` for development.