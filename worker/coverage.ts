export interface CoverageArticle {
  url: string
  canonical_url?: string
  title?: string
  outlet?: string
  published_at?: string | null
  snippet?: string
  summary?: string
  relevance_score?: number
  importance_score?: number
  labels?: string[]
}

export interface CoveragePipelineInput {
  rss_url: string
}

/**
 * Fetches coverage articles from the configured pipeline (alerts/feeds).
 * Returns a list of articles ready to be upserted into the articles table.
 */
export async function fetchCoverage(
  _orgId: string,
  _clientId: string,
  alerts: CoveragePipelineInput[],
  _sinceTs: string
): Promise<CoverageArticle[]> {
  const endpoint = process.env.GUMLOOP_ENDPOINT!
  const apiKey = process.env.GUMLOOP_API_KEY!
  const userId = process.env.GUMLOOP_USER_ID!
  const savedItemId = process.env.GUMLOOP_SAVED_ITEM_ID!
  const startUrl = `${endpoint}?api_key=${apiKey}&user_id=${userId}&saved_item_id=${savedItemId}`
  const rssUrl = alerts[0]?.rss_url || ''

  console.log(`[CoveragePipeline] Starting with URL:`, rssUrl)

  try {
    const startResponse = await fetch(startUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: rssUrl
    })

    if (!startResponse.ok) {
      const text = await startResponse.text()
      console.error(`[CoveragePipeline] Error starting pipeline:`, text)
      throw new Error(`Pipeline error: ${startResponse.status} ${text}`)
    }

    const startData = await startResponse.json()
    console.log(`[CoveragePipeline] Started:`, JSON.stringify(startData, null, 2))

    const runId = startData.run_id
    if (!runId) {
      console.log(`[CoveragePipeline] No run_id, using direct results`)
      return (startData.results || []).map(normalizeItem)
    }

    console.log(`[CoveragePipeline] Polling run_id: ${runId}`)
    const pollUrl = `https://api.gumloop.com/api/v1/get_pl_run?api_key=${apiKey}&run_id=${runId}&user_id=${userId}`
    const maxAttempts = 60
    let attempts = 0

    while (attempts < maxAttempts) {
      await new Promise((r) => setTimeout(r, 5000))
      attempts++
      console.log(`[CoveragePipeline] Poll ${attempts}/${maxAttempts}`)

      const pollResponse = await fetch(pollUrl, { method: 'GET' })
      if (!pollResponse.ok) {
        console.error(`[CoveragePipeline] Poll error: ${pollResponse.status}`)
        continue
      }

      const pollData = await pollResponse.json()
      console.log(`[CoveragePipeline] State: ${pollData.state}`)

      if (pollData.state === 'DONE' || pollData.state === 'COMPLETED') {
        console.log(`[CoveragePipeline] Done`)
        const outputs = pollData.outputs || {}

        for (const key of Object.keys(outputs)) {
          const value = outputs[key]
          if (Array.isArray(value) && value.length > 0) {
            const results = value.map(normalizeItem).filter((r: CoverageArticle) => r.url)
            console.log(`[CoveragePipeline] Found ${results.length} articles`)
            return results
          }
        }
        return []
      }

      if (pollData.state === 'FAILED' || pollData.state === 'ERROR') {
        console.error(`[CoveragePipeline] Failed:`, JSON.stringify(pollData, null, 2))
        throw new Error(`Pipeline failed: ${pollData.error || pollData.message || pollData.log || 'Unknown'}`)
      }
    }

    throw new Error('Coverage pipeline timed out after 5 minutes')
  } catch (error) {
    console.error(`[CoveragePipeline] Error:`, error)
    throw error
  }
}

function normalizeItem(item: unknown): CoverageArticle {
  if (typeof item === 'string') {
    const outletMatch = item.match(/<b>([^<]+)<\/b>/)
    const dateMatch = item.match(/\(([^)]+)\)/)
    const urlMatch = item.match(/https?:\/\/[^\s<]+/)
    let title = ''
    const titleMatch = item.match(/<br>([^<]+)<br>https?:\/\//)
    if (titleMatch) title = titleMatch[1].trim()
    const url = urlMatch ? urlMatch[0].replace(/<br>/g, '') : ''
    return {
      url,
      canonical_url: url,
      title,
      outlet: outletMatch ? outletMatch[1] : '',
      published_at: dateMatch ? new Date(dateMatch[1]).toISOString() : null,
      snippet: '',
      summary: '',
      relevance_score: 50,
      importance_score: 50,
      labels: []
    }
  }

  const o = item as Record<string, unknown>
  const url = [o.url, o.link, o.URL, o.Link, o.article_url].find(Boolean) as string | undefined
  const u = url || ''
  return {
    url: u,
    canonical_url: (o.canonical_url as string) || u,
    title: (o.title ?? o.Title ?? o.headline ?? '') as string,
    outlet: (o.outlet ?? o.source ?? o.Source ?? o.publisher ?? '') as string,
    published_at: (o.published_at ?? o.date ?? o.Date ?? o.published ?? null) as string | null,
    snippet: (o.snippet ?? o.description ?? o.Description ?? o.content ?? '') as string,
    summary: (o.summary ?? o.Summary ?? '') as string,
    relevance_score: (o.relevance_score ?? o.relevance ?? 0) as number,
    importance_score: (o.importance_score ?? o.importance ?? 0) as number,
    labels: (o.labels ?? o.tags ?? []) as string[]
  }
}
