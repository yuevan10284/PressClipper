import type { SupabaseClient } from '@supabase/supabase-js'
import type { CoverageArticle } from './coverage'

export interface AlertWithChecked {
  id: string
  query: string
  last_checked_at: string | null
  [key: string]: unknown
}

/**
 * Strip tracking parameters from URL. Used when building canonical_url for articles.
 */
export function canonicalizeUrl(url: string): string {
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

/**
 * Get client and active alerts for a client id. Supabase client must have service role or equivalent access.
 */
export async function getClientWithAlerts(
  supabase: SupabaseClient,
  clientId: string
): Promise<{ client: Record<string, unknown>; alerts: AlertWithChecked[] }> {
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

  return { client, alerts: (alerts ?? []) as AlertWithChecked[] }
}

/**
 * Compute since_ts for coverage fetch: newest last_checked_at among alerts, or 24h ago.
 */
export function computeSinceTs(alerts: AlertWithChecked[]): string {
  const lastCheckedDates = alerts
    .filter(a => a.last_checked_at)
    .map(a => new Date(a.last_checked_at!).getTime())

  if (lastCheckedDates.length > 0) {
    return new Date(Math.max(...lastCheckedDates)).toISOString()
  }
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
}

/**
 * Map coverage results to article rows and upsert. Uses canonicalizeUrl and falls back
 * published_at to now when null so undated articles show in date-filtered coverage.
 */
export async function upsertArticles(
  supabase: SupabaseClient,
  orgId: string,
  clientId: string,
  results: CoverageArticle[]
): Promise<void> {
  if (results.length === 0) {
    return
  }

  const nowIso = new Date().toISOString()
  const articles = results.map(r => ({
    org_id: orgId,
    client_id: clientId,
    url: r.url,
    canonical_url: r.canonical_url || canonicalizeUrl(r.url),
    title: r.title || null,
    outlet: r.outlet || null,
    published_at: r.published_at || nowIso,
    snippet: r.snippet || null,
    summary: r.summary || null,
    relevance_score: r.relevance_score ?? 0,
    importance_score: r.importance_score ?? 0,
    labels: r.labels ?? []
  }))

  const { error } = await supabase
    .from('articles')
    .upsert(articles, {
      onConflict: 'client_id,canonical_url',
      ignoreDuplicates: false
    })

  if (error) {
    throw error
  }
}

/**
 * Update alerts' last_checked_at to now.
 */
export async function updateAlertsChecked(
  supabase: SupabaseClient,
  alertIds: string[]
): Promise<void> {
  if (alertIds.length === 0) return

  const { error } = await supabase
    .from('alerts')
    .update({ last_checked_at: new Date().toISOString() })
    .in('id', alertIds)

  if (error) {
    throw error
  }
}
