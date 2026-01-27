import * as dotenv from 'dotenv'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import { fetchCoverage, type CoverageArticle } from './coverage'

// Load .env.local file
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

// Configuration
const POLL_INTERVAL_MS = 5000 // 5 seconds

// Create Supabase client with service role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

// Types
interface Alert {
  id: string
  rss_url: string
  label: string | null
  last_checked_at: string | null
}

// Strip tracking parameters from URL
function canonicalizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'gclid', 'fbclid', 'msclkid', 'mc_eid', 'yclid', 'ref', '_ga'
    ]
    
    trackingParams.forEach(param => {
      parsed.searchParams.delete(param)
    })
    
    if (parsed.hash && parsed.hash.includes('=')) {
      parsed.hash = ''
    }
    
    return parsed.toString()
  } catch {
    return url
  }
}

// Get the next queued run
async function getNextQueuedRun() {
  const { data: run, error } = await supabase
    .from('runs')
    .select('*')
    .eq('status', 'QUEUED')
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (error || !run) {
    return null
  }

  return run
}

// Mark run as running
async function markRunning(runId: string) {
  const { error } = await supabase
    .from('runs')
    .update({
      status: 'RUNNING',
      started_at: new Date().toISOString()
    })
    .eq('id', runId)
    .eq('status', 'QUEUED') // Optimistic lock

  return !error
}

// Mark run as completed
async function markCompleted(runId: string, status: 'SUCCESS' | 'FAILED', errorMessage?: string) {
  await supabase
    .from('runs')
    .update({
      status,
      finished_at: new Date().toISOString(),
      error_message: errorMessage || null
    })
    .eq('id', runId)
}

// Get client and alerts
async function getClientWithAlerts(clientId: string) {
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single()

  if (clientError || !client) {
    throw new Error(`Client not found: ${clientId}`)
  }

  const { data: alerts, error: alertsError } = await supabase
    .from('alerts')
    .select('*')
    .eq('client_id', clientId)
    .eq('active', true)

  if (alertsError) {
    throw new Error(`Failed to fetch alerts: ${alertsError.message}`)
  }

  return { client, alerts: alerts || [] }
}

// Upsert articles
async function upsertArticles(
  orgId: string,
  clientId: string,
  results: CoverageArticle[]
) {
  if (results.length === 0) {
    console.log('[Worker] No articles to upsert')
    return
  }

  const articles = results.map(r => ({
    org_id: orgId,
    client_id: clientId,
    url: r.url,
    canonical_url: r.canonical_url || canonicalizeUrl(r.url),
    title: r.title || null,
    outlet: r.outlet || null,
    published_at: r.published_at || null,
    snippet: r.snippet || null,
    summary: r.summary || null,
    relevance_score: r.relevance_score || 0,
    importance_score: r.importance_score || 0,
    labels: r.labels || []
  }))

  // Upsert using the unique constraint on (client_id, canonical_url)
  const { error } = await supabase
    .from('articles')
    .upsert(articles, {
      onConflict: 'client_id,canonical_url',
      ignoreDuplicates: false
    })

  if (error) {
    console.error('[Worker] Failed to upsert articles:', error)
    throw error
  }

  console.log(`[Worker] Upserted ${articles.length} articles`)
}

// Update alerts' last_checked_at
async function updateAlertsChecked(alertIds: string[]) {
  if (alertIds.length === 0) return

  const { error } = await supabase
    .from('alerts')
    .update({ last_checked_at: new Date().toISOString() })
    .in('id', alertIds)

  if (error) {
    console.error('[Worker] Failed to update alerts:', error)
  }
}

// Process a single run
async function processRun(run: any) {
  console.log(`[Worker] Processing run ${run.id} for client ${run.client_id}`)

  try {
    // Get client and alerts
    const { client, alerts } = await getClientWithAlerts(run.client_id)

    if (alerts.length === 0) {
      console.log('[Worker] No active alerts for client, marking as success')
      await markCompleted(run.id, 'SUCCESS')
      return
    }

    // Calculate since_ts: newest last_checked_at or 24h ago
    const lastCheckedDates = alerts
      .filter(a => a.last_checked_at)
      .map(a => new Date(a.last_checked_at!).getTime())
    
    let sinceTs: string
    if (lastCheckedDates.length > 0) {
      sinceTs = new Date(Math.max(...lastCheckedDates)).toISOString()
    } else {
      sinceTs = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    }

    console.log(`[Worker] Using since_ts: ${sinceTs}`)

    const results = await fetchCoverage(run.org_id, run.client_id, alerts, sinceTs)

    // Upsert articles
    await upsertArticles(run.org_id, run.client_id, results)

    // Update alerts
    await updateAlertsChecked(alerts.map(a => a.id))

    // Mark success
    await markCompleted(run.id, 'SUCCESS')
    console.log(`[Worker] Run ${run.id} completed successfully`)
  } catch (error: any) {
    console.error(`[Worker] Run ${run.id} failed:`, error)
    await markCompleted(run.id, 'FAILED', error.message || 'Unknown error')
  }
}

// Main worker loop
async function workerLoop() {
  console.log('[Worker] Starting PressClipper worker...')
  console.log(`[Worker] Poll interval: ${POLL_INTERVAL_MS}ms`)
  console.log(`[Worker] Coverage pipeline configured`)

  while (true) {
    try {
      // Get next queued run
      const run = await getNextQueuedRun()

      if (run) {
        // Try to mark as running (optimistic lock)
        const acquired = await markRunning(run.id)
        
        if (acquired) {
          await processRun(run)
        } else {
          console.log(`[Worker] Run ${run.id} was claimed by another worker`)
        }
      }
    } catch (error) {
      console.error('[Worker] Error in worker loop:', error)
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
  }
}

// Validate environment variables
function validateEnv() {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'GUMLOOP_ENDPOINT',
    'GUMLOOP_API_KEY',
    'GUMLOOP_USER_ID',
    'GUMLOOP_SAVED_ITEM_ID'
  ]

  const missing = required.filter(key => !process.env[key])
  
  if (missing.length > 0) {
    console.error('[Worker] Missing environment variables:', missing.join(', '))
    process.exit(1)
  }
}

// Start the worker
validateEnv()
workerLoop().catch(error => {
  console.error('[Worker] Fatal error:', error)
  process.exit(1)
})
