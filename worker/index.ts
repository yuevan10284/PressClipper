import * as dotenv from 'dotenv'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

// Load .env.local file
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

// Configuration
const POLL_INTERVAL_MS = 5000 // 5 seconds
const GUMLOOP_ENDPOINT = process.env.GUMLOOP_ENDPOINT!
const GUMLOOP_API_KEY = process.env.GUMLOOP_API_KEY!
const GUMLOOP_USER_ID = process.env.GUMLOOP_USER_ID!
const GUMLOOP_SAVED_ITEM_ID = process.env.GUMLOOP_SAVED_ITEM_ID!

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

interface GumloopResult {
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

interface GumloopResponse {
  results?: GumloopResult[]
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

// Call Gumloop API - starts a pipeline and polls for results
async function callGumloop(
  orgId: string,
  clientId: string,
  alerts: Alert[],
  sinceTs: string
): Promise<GumloopResult[]> {
  // Use api_key as query parameter (not Bearer token)
  const startUrl = `${GUMLOOP_ENDPOINT}?api_key=${GUMLOOP_API_KEY}&user_id=${GUMLOOP_USER_ID}&saved_item_id=${GUMLOOP_SAVED_ITEM_ID}`
  
  // Send just the raw URL string - the validator expects a plain URL
  const rssUrl = alerts[0]?.rss_url || ''

  console.log(`[Gumloop] Starting pipeline with URL:`, rssUrl)

  try {
    // Step 1: Start the pipeline - send URL as plain text
    const startResponse = await fetch(startUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain'
      },
      body: rssUrl
    })

    if (!startResponse.ok) {
      const text = await startResponse.text()
      console.error(`[Gumloop] Error starting pipeline:`, text)
      throw new Error(`Gumloop API error: ${startResponse.status} ${text}`)
    }

    const startData = await startResponse.json()
    console.log(`[Gumloop] Pipeline started:`, JSON.stringify(startData, null, 2))
    
    const runId = startData.run_id
    if (!runId) {
      console.log(`[Gumloop] No run_id returned, checking for direct results`)
      return startData.results || []
    }

    // Step 2: Poll for results
    console.log(`[Gumloop] Polling for results, run_id: ${runId}`)
    const pollUrl = `https://api.gumloop.com/api/v1/get_pl_run?api_key=${GUMLOOP_API_KEY}&run_id=${runId}&user_id=${GUMLOOP_USER_ID}`
    
    const maxAttempts = 60 // 5 minutes max (60 * 5 seconds)
    let attempts = 0
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)) // Wait 5 seconds
      attempts++
      
      console.log(`[Gumloop] Poll attempt ${attempts}/${maxAttempts}`)
      
      const pollResponse = await fetch(pollUrl, {
        method: 'GET'
      })
      
      if (!pollResponse.ok) {
        console.error(`[Gumloop] Poll error: ${pollResponse.status}`)
        continue
      }
      
      const pollData = await pollResponse.json()
      console.log(`[Gumloop] Poll response state: ${pollData.state}`)
      
      if (pollData.state === 'DONE' || pollData.state === 'COMPLETED') {
        console.log(`[Gumloop] Pipeline completed!`)
        // Parse outputs - Gumloop returns outputs as a map
        const outputs = pollData.outputs || {}
        
        console.log(`[Gumloop] Raw outputs:`, JSON.stringify(outputs, null, 2))
        
        // Try to find results in the outputs
        // The exact key depends on your Gumloop pipeline configuration
        let results: GumloopResult[] = []
        
        for (const key of Object.keys(outputs)) {
          console.log(`[Gumloop] Checking output key: ${key}`)
          const value = outputs[key]
          
          if (Array.isArray(value) && value.length > 0) {
            console.log(`[Gumloop] First item sample:`, JSON.stringify(value[0], null, 2))
            
            results = value.map((item: any) => {
              // Check if item is a string (HTML format from Gumloop) or object
              if (typeof item === 'string') {
                // Parse HTML format: "<b>OUTLET</b> (DATE)<br>TITLE<br>URL<br><br>"
                const outletMatch = item.match(/<b>([^<]+)<\/b>/)
                const dateMatch = item.match(/\(([^)]+)\)/)
                const urlMatch = item.match(/https?:\/\/[^\s<]+/)
                
                // Extract title: text between </b>...<br> and <br>https://
                let title = ''
                const titleMatch = item.match(/<br>([^<]+)<br>https?:\/\//)
                if (titleMatch) {
                  title = titleMatch[1].trim()
                }
                
                const url = urlMatch ? urlMatch[0].replace(/<br>/g, '') : ''
                
                return {
                  url: url,
                  canonical_url: url,
                  title: title,
                  outlet: outletMatch ? outletMatch[1] : '',
                  published_at: dateMatch ? new Date(dateMatch[1]).toISOString() : null,
                  snippet: '',
                  summary: '',
                  relevance_score: 50, // Default score
                  importance_score: 50,
                  labels: []
                }
              } else {
                // Handle structured object format
                const url = item.url || item.link || item.URL || item.Link || item.article_url || ''
                return {
                  url: url,
                  canonical_url: item.canonical_url || url,
                  title: item.title || item.Title || item.headline || '',
                  outlet: item.outlet || item.source || item.Source || item.publisher || '',
                  published_at: item.published_at || item.date || item.Date || item.published || null,
                  snippet: item.snippet || item.description || item.Description || item.content || '',
                  summary: item.summary || item.Summary || '',
                  relevance_score: item.relevance_score || item.relevance || 0,
                  importance_score: item.importance_score || item.importance || 0,
                  labels: item.labels || item.tags || []
                }
              }
            }).filter(r => r.url) // Only keep results with URLs
            break
          }
        }
        
        console.log(`[Gumloop] Found ${results.length} valid results with URLs`)
        return results
      } else if (pollData.state === 'FAILED' || pollData.state === 'ERROR') {
        console.error(`[Gumloop] Pipeline failed. Full response:`, JSON.stringify(pollData, null, 2))
        throw new Error(`Gumloop pipeline failed: ${pollData.error || pollData.message || pollData.log || 'Unknown error'}`)
      }
      // Otherwise state is RUNNING/PENDING, keep polling
    }
    
    throw new Error('Gumloop pipeline timed out after 5 minutes')
  } catch (error) {
    console.error(`[Gumloop] Request failed:`, error)
    throw error
  }
}

// Upsert articles
async function upsertArticles(
  orgId: string,
  clientId: string,
  results: GumloopResult[]
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

    // Call Gumloop
    const results = await callGumloop(run.org_id, run.client_id, alerts, sinceTs)

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
  console.log(`[Worker] Gumloop endpoint: ${GUMLOOP_ENDPOINT}`)

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
