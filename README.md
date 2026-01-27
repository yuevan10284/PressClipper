# PressClipper.

A media monitoring SaaS application that allows users to track press coverage for their clients using Google Alerts RSS feeds.

## Features

- **User Authentication**: Sign up and log in with Supabase Auth
- **Client Management**: Create and manage multiple clients
- **Google Alerts Integration**: Add RSS feed URLs from Google Alerts per client
- **Async Processing**: Click "Refresh Now" to trigger a Gumloop automation run
- **Coverage Feed**: View articles with filters (date range, relevance score, search text)

## Tech Stack

- **Framework**: Next.js 14 (App Router) + TypeScript
- **Styling**: TailwindCSS
- **Backend**: Supabase (Auth + PostgreSQL)
- **Queue**: Database-backed queue with Node worker script
- **Automation**: Gumloop API

## Environment Variables

Create a `.env.local` file in the root directory:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Gumloop
GUMLOOP_ENDPOINT=https://api.gumloop.com/api/v1/start_pipeline
GUMLOOP_API_KEY=your_gumloop_api_key
GUMLOOP_USER_ID=your_gumloop_user_id
GUMLOOP_SAVED_ITEM_ID=your_gumloop_saved_item_id

# SerpApi (coverage pipeline – used by worker and refresh; replaces the previous Serper pipeline)
SERPAPI_KEY=your_serpapi_api_key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Security Notes

- `NEXT_PUBLIC_*` variables are exposed to the browser
- `SUPABASE_SERVICE_ROLE_KEY`, `GUMLOOP_API_KEY`, and `SERPAPI_KEY` are **server-side only**
- Never commit `.env.local` to version control

## Database Setup

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Copy your project URL and keys from Settings > API

### 2. Run the Database Migration

1. Go to your Supabase Dashboard > SQL Editor
2. Copy the contents of `supabase/migrations/001_initial_schema.sql`
3. Run the SQL to create all tables, indexes, and RLS policies

The migration will:
- Create tables: `organizations`, `memberships`, `clients`, `alerts`, `runs`, `articles`
- Set up Row Level Security policies
- Create a trigger to auto-create an organization when a user signs up

## Local Development

### Prerequisites

- Node.js 18+
- npm or pnpm

### Installation

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Running the Worker

The worker processes queued runs in the background:

```bash
# In a separate terminal
npm run worker
```

The worker:
- Polls for queued runs every 5 seconds
- Fetches coverage via SerpApi (past-24h results, paginated) using alert queries
- Upserts articles to the database
- Marks runs as SUCCESS or FAILED

`SERPAPI_KEY` must be set when running the worker.

## API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/clients` | List all clients |
| POST | `/api/clients` | Create a new client |
| GET | `/api/clients/:id` | Get client details |
| DELETE | `/api/clients/:id` | Delete a client |
| POST | `/api/clients/:id/alerts` | Add an RSS feed |
| DELETE | `/api/clients/:id/alerts?alertId=` | Delete an RSS feed |
| POST | `/api/clients/:id/refresh` | Queue a new run |
| GET | `/api/clients/:id/coverage` | Get articles with filters |
| GET | `/api/runs/:runId` | Get run status |

### Coverage Query Parameters

- `from` - Start date (ISO 8601)
- `to` - End date (ISO 8601)
- `q` - Search text (searches title, outlet, snippet)
- `minScore` - Minimum relevance score (0-100)
- `limit` - Number of results (default: 50)
- `offset` - Pagination offset

## Gumloop Integration

### Request Format (sent to Gumloop)

```json
{
  "org_id": "uuid",
  "client_id": "uuid",
  "alerts": [
    { "alert_id": "uuid", "query": "https://..." }
  ],
  "since_ts": "2024-01-01T00:00:00Z"
}
```

### Expected Response (from Gumloop)

```json
{
  "results": [
    {
      "url": "https://example.com/article",
      "canonical_url": "https://example.com/article",
      "title": "Article Title",
      "outlet": "News Outlet",
      "published_at": "2024-01-01T00:00:00Z",
      "snippet": "Article snippet...",
      "summary": "AI-generated summary...",
      "relevance_score": 85,
      "importance_score": 70,
      "labels": ["technology", "press release"]
    }
  ]
}
```

## Project Structure

```
├── src/
│   ├── app/
│   │   ├── (app)/            # Protected app routes
│   │   │   ├── clients/      # Client pages
│   │   │   ├── dashboard/    # Dashboard page
│   │   │   └── layout.tsx    # Forces dynamic rendering
│   │   ├── (auth)/           # Auth routes
│   │   │   ├── login/        # Login page
│   │   │   └── layout.tsx    # Forces dynamic rendering
│   │   ├── api/              # API routes
│   │   ├── globals.css       # Global styles
│   │   ├── layout.tsx        # Root layout
│   │   └── page.tsx          # Home (redirect)
│   ├── components/
│   │   ├── layout/           # Layout components (Navbar)
│   │   └── ui/               # UI components (Button, Input, Card, Badge)
│   ├── lib/
│   │   ├── supabase/         # Supabase clients (client, server, middleware)
│   │   ├── auth.ts           # Auth helpers (getUserAndOrg, verifyClientAccess)
│   │   ├── types.ts          # TypeScript types
│   │   └── utils.ts          # Utility functions
│   └── middleware.ts         # Next.js middleware for auth
├── worker/
│   └── index.ts              # Background worker script
├── supabase/
│   └── migrations/           # SQL migrations
└── package.json
```

## Production Deployment

### Next.js App

Deploy to Vercel, Netlify, or any Node.js hosting:

```bash
npm run build
npm start
```

### Worker

The worker should run as a separate process. Options:
- Run on a VPS with PM2 or systemd
- Use a serverless function with a cron trigger
- Deploy to Railway, Render, or Fly.io

Example PM2 configuration:

```bash
pm2 start "npm run worker" --name pressclipper-worker
```

## License

MIT
