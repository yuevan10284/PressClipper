// Database types

export interface Organization {
  id: string
  name: string
  created_at: string
}

export interface Membership {
  user_id: string
  org_id: string
  role: string
  created_at: string
}

export interface Client {
  id: string
  org_id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface Alert {
  id: string
  client_id: string
  query: string
  label: string | null
  last_checked_at: string | null
  active: boolean
  created_at: string
}

export interface Run {
  id: string
  org_id: string
  client_id: string
  status: 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED'
  started_at: string | null
  finished_at: string | null
  error_message: string | null
  created_at: string
}

export interface Article {
  id: string
  org_id: string
  client_id: string
  canonical_url: string
  url: string
  title: string | null
  outlet: string | null
  published_at: string | null
  snippet: string | null
  summary: string | null
  relevance_score: number
  importance_score: number
  labels: string[]
  created_at: string
}

// API types

export interface ClientWithDetails extends Client {
  alerts: Alert[]
  runs: Run[]
  last_run: Run | null
  alerts_count?: number
}

export interface GumloopPayload {
  org_id: string
  client_id: string
  alerts: Array<{
    alert_id: string
    query: string
  }>
  since_ts: string
}

export interface GumloopResult {
  url: string
  canonical_url?: string
  title?: string
  outlet?: string
  published_at?: string
  snippet?: string
  summary?: string
  relevance_score?: number
  importance_score?: number
  labels?: string[]
}

export interface GumloopResponse {
  run_id?: string
  results?: GumloopResult[]
}
