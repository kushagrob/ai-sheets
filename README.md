# AI Sheets

AI-powered spreadsheet application with intelligent data analysis and manipulation capabilities. Built with Next.js, React, TypeScript, and powered by Anthropic's Claude AI. Inspired by https://www.tryshortcut.ai/

## Demo

https://github.com/user-attachments/assets/c8f67bfc-00f6-4ec6-a4af-394f9213ffd3

## Overview

AI Sheets provides a Google Sheets-like interface enhanced with AI assistance for data analysis, formula creation, and spreadsheet manipulation. The application features real-time AI chat integration that can help users perform complex data operations, create visualizations, and analyze their data intelligently.

## Features

- **Spreadsheet Interface**: Full-featured spreadsheet with cells, formulas, and data manipulation
- **AI Integration**: Chat with Claude AI to perform data analysis and spreadsheet operations
- **Excel Import/Export**: Support for Excel file formats
- **Real-time Collaboration**: Built for modern web workflows
- **Responsive Design**: Works on desktop and mobile devices

## Getting Started

### Prerequisites

- **Node.js** 18 or later
- **pnpm** (recommended) or npm
- **Anthropic API Key** (for AI functionality)

### Installation & Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/ai-sheets.git
   cd ai-sheets
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   # or
   npm install
   ```

3. **Environment Setup**
   
   Create a `.env.local` file in the root directory:
   ```env
   ANTHROPIC_API_KEY=your_anthropic_api_key_here
   ```
   
   You can get your API key from [Anthropic's Console](https://console.anthropic.com/)

4. **Run the development server**
   ```bash
   pnpm dev
   # or
   npm run dev
   ```

5. **Open the application**
   
   Navigate to [http://localhost:3000](http://localhost:3000) in your browser

### Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server on port 3000 |
| `pnpm build` | Build the application for production |
| `pnpm start` | Start the production server |
| `pnpm lint` | Run ESLint to check code quality |

### Project Structure

```
ai-sheets/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── features/         # Feature-specific components
│   ├── layout/           # Layout components
│   └── ui/               # Reusable UI components
├── hooks/                # Custom React hooks
├── state/                # State management (Zustand)
├── types/                # TypeScript type definitions
└── public/               # Static assets
```

## Technology Stack

- **Frontend**: Next.js 14, React, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui components
- **AI**: Anthropic Claude API via Vercel AI SDK
- **State Management**: Zustand
- **Data Processing**: xlsx, papaparse
- **Icons**: Lucide React

## Usage

### Basic Operations
- **Create spreadsheets**: Click on cells to edit and enter data
- **Use formulas**: Start with `=` to create Excel-like formulas
- **AI assistance**: Use the chat panel to ask for data analysis, formula creation, or spreadsheet operations
- **Import/Export**: Load Excel files or export your work

### AI Chat Features
- Ask questions about your data
- Request automated data analysis
- Generate formulas and calculations
- Create charts and visualizations
- Perform data transformations

### Example AI Commands
- "Analyze the sales data and show trends"
- "Create a formula to calculate monthly growth rate"
- "Generate a chart showing revenue by quarter"
- "Find outliers in column B"

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.