# AI Trading Agent - Web Application

A modern, Cursor-style workbench UI for AI-powered algorithmic trading built with Next.js 14, TypeScript, and Tailwind CSS.

## Features

- **Cursor-style Workbench**: Dark theme with collapsible sidebar and modern UI components
- **Multi-Agent System**: Real-time display of Technical, News, and Portfolio Manager agent outputs
- **Human-in-the-Loop**: Approve/Reject workflow for trading decisions
- **Live Dashboard**: Real-time market metrics, sentiment analysis, and trading signals
- **Responsive Design**: Works on desktop and tablet screens
- **Mock Data Support**: Works offline with realistic mock data

## Pages

1. **/agents** - Main workbench showing agent outputs, rationales, and consensus decisions
2. **/dashboard** - Operator dashboard with live metrics and recent signals
3. **/bot** - AI Trading Bot configuration and status (coming soon)

## Tech Stack

- **Next.js 14** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **shadcn/ui** for UI components
- **Lucide React** for icons
- **SWR** for data fetching
- **Framer Motion** for animations
- **Zod** for validation

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp env.example .env.local

# Start development server
npm run dev
```

The application will be available at `http://localhost:3000`.

### Environment Variables

Create a `.env.local` file with the following variables:

```env
# Worker API Configuration
WORKER_BASE_URL=http://localhost:7070

# Next.js Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional: Feature Flags
NEXT_PUBLIC_ENABLE_DEMO_MODE=true
NEXT_PUBLIC_ENABLE_MOCK_DATA=true
```

### Connecting to Worker

To connect to the LangGraph worker:

1. Set `WORKER_BASE_URL` in your `.env.local` file
2. Ensure the worker is running on the specified URL
3. The UI will automatically proxy requests to the worker

If `WORKER_BASE_URL` is not set, the UI will use mock data and display "Demo Mode".

## Keyboard Shortcuts

- **⌘+Enter** - Start a new trading run
- **⌘+A** - Approve current run
- **⌘+R** - Reject current run
- **⌘+K** - Open command palette (coming soon)

## Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run typecheck    # Run TypeScript checks
npm run format       # Format code with Prettier
```

### Project Structure

```
app/
├── (app)/           # App layout group
│   ├── layout.tsx   # Main app layout with sidebar
│   ├── page.tsx     # Overview page (redirects to agents)
│   ├── agents/      # Agents workbench
│   ├── dashboard/   # Operator dashboard
│   └── bot/         # AI bot configuration
├── api/             # API routes
│   ├── runs/        # Trading runs API
│   ├── metrics/     # Market metrics API
│   └── signals/     # Recent signals API
└── globals.css      # Global styles

components/
├── ui/              # Reusable UI components
│   ├── button.tsx
│   ├── card.tsx
│   ├── badge.tsx
│   └── ...
└── agents/          # Agent-specific components
    ├── AgentPanel.tsx
    ├── RunHeader.tsx
    └── RunTimeline.tsx

lib/
├── utils.ts         # Utility functions
├── schemas.ts       # Zod validation schemas
└── fetcher.ts       # SWR fetcher with error handling
```

### Design System

- **Colors**: Slate-900 background, slate-850 panels, indigo-500 primary
- **Typography**: Inter font family, 15px base size
- **Spacing**: 4/8/12/16 spacing scale
- **Animations**: 120ms ease-out for interactions, 200-300ms for panels

## API Integration

The web app proxies requests to the LangGraph worker API:

- `POST /api/runs` → `{WORKER_BASE_URL}/runs`
- `GET /api/runs/[id]` → `{WORKER_BASE_URL}/runs/{id}`
- `POST /api/runs/[id]/resume` → `{WORKER_BASE_URL}/runs/{id}/resume`
- `GET /api/metrics/market` → `{WORKER_BASE_URL}/metrics/market`
- `GET /api/metrics/sentiment` → `{WORKER_BASE_URL}/metrics/sentiment`
- `GET /api/signals/recent` → `{WORKER_BASE_URL}/signals/recent`

All endpoints include proper error handling and fallback to mock data when the worker is unavailable.

## Contributing

1. Follow the existing code style and patterns
2. Use TypeScript for all new code
3. Add proper error handling and loading states
4. Test with both connected and disconnected worker states
5. Ensure responsive design works on target screen sizes

## License

MIT License - see LICENSE file for details.
