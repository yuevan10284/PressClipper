import * as dotenv from 'dotenv'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import { fetchCoverage } from './coverage'
import {
  getClientWithAlerts,
  computeSinceTs,
  upsertArticles,
  updateAlertsChecked
} from './run'

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

// Process a single run
async function processRun(run: any) {
  console.log(`[Worker] Processing run ${run.id} for client ${run.client_id}`)

  try {
    const { client, alerts } = await getClientWithAlerts(supabase, run.client_id)

    if (alerts.length === 0) {
      console.log('[Worker] No active alerts for client, marking as success')
      await markCompleted(run.id, 'SUCCESS')
      return
    }

    const sinceTs = computeSinceTs(alerts)
    console.log(`[Worker] Using since_ts: ${sinceTs}`)

    const results = await fetchCoverage(run.org_id, run.client_id, alerts, sinceTs)

    await upsertArticles(supabase, run.org_id, run.client_id, results)
    console.log(`[Worker] Upserted ${results.length} articles`)

    await updateAlertsChecked(supabase, alerts.map(a => a.id))

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
    'SERPER_KEY'
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
