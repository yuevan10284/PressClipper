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
  query: string
}

const SERPAPI_KEY = process.env.SERPAPI_KEY!
const SERPAPI_BASE = 'https://serpapi.com/search.json'
const DEFAULT_LOCATION = 'United States'
const MAX_PAGES = 100

interface SerpApiOrganicItem {
  link?: string
  title?: string
  snippet?: string
  date?: string
  position?: number
  source?: string
}

interface SerpApiResponse {
  search_metadata?: { status?: string }
  error?: string
  organic_results?: SerpApiOrganicItem[]
  serpapi_pagination?: { next?: string; next_link?: string }
}

function itemToArticle(item: SerpApiOrganicItem): CoverageArticle {
  const url = item.link || ''
  let outlet: string | undefined = item.source?.trim() || undefined
  if (!outlet && url) {
    try {
      outlet = new URL(url).hostname
    } catch {
      outlet = undefined
    }
  }
  let published_at: string | null = null
  if (item.date) {
    const d = new Date(item.date)
    if (!isNaN(d.getTime())) published_at = d.toISOString()
  }
  return {
    url,
    canonical_url: url,
    title: item.title ?? undefined,
    outlet,
    published_at,
    snippet: item.snippet ?? undefined,
    summary: undefined,
    relevance_score: 50,
    importance_score: 50,
    labels: []
  }
}

/**
 * Fetches coverage articles using SerpApi (serpapi.com).
 * For each alert with non-empty query, GETs serpapi.com/search.json with q, tbs=qdr:d (past 24h);
 * paginates using serpapi_pagination.next until no next page, organic_results empty, or max pages.
 * Maps to CoverageArticle and dedupes by link.
 */
export async function fetchCoverage(
  _orgId: string,
  _clientId: string,
  alerts: CoveragePipelineInput[],
  _sinceTs: string
): Promise<CoverageArticle[]> {
  const alertsWithQuery = alerts.filter((a) => typeof a.query === 'string' && a.query.trim().length > 0)
  if (alertsWithQuery.length === 0) {
    return []
  }

  const seenUrls = new Set<string>()
  const articles: CoverageArticle[] = []

  for (const alert of alertsWithQuery) {
    const q = alert.query.trim()
    console.log(`[Coverage] Searching for: "${q}"`)

    const initialParams = new URLSearchParams({
      engine: 'google',
      q,
      tbs: 'qdr:d',
      hl: 'en',
      gl: 'us',
      google_domain: 'google.com',
      api_key: SERPAPI_KEY,
      location: DEFAULT_LOCATION
    })

    let nextUrl: string | null = `${SERPAPI_BASE}?${initialParams.toString()}`
    let pageCount = 0

    while (nextUrl && pageCount < MAX_PAGES) {
      try {
        const res = await fetch(nextUrl)

        if (!res.ok) {
          const text = await res.text()
          console.error(`[Coverage] SerpApi error (q="${q}", page=${pageCount + 1}): ${res.status} ${text}`)
          throw new Error(`SerpApi error: ${res.status} ${text}`)
        }

        const data: SerpApiResponse = await res.json()

        if (data.error) {
          console.error(`[Coverage] SerpApi error (q="${q}", page=${pageCount + 1}): ${data.error}`)
          throw new Error(`SerpApi error: ${data.error}`)
        }
        if (data.search_metadata?.status === 'Error') {
          const msg = data.error ?? 'Search failed'
          throw new Error(`SerpApi error: ${msg}`)
        }

        const organic = data.organic_results ?? []
        if (organic.length === 0) break

        for (const item of organic) {
          const link = item.link
          if (!link || link.trim() === '' || seenUrls.has(link)) continue
          seenUrls.add(link)
          articles.push(itemToArticle(item))
        }

        const pagination = data.serpapi_pagination
        const nextLink = pagination?.next ?? pagination?.next_link
        if (!nextLink || !nextLink.trim()) break

        const nextParsed = new URL(nextLink)
        nextParsed.searchParams.set('api_key', SERPAPI_KEY)
        nextUrl = nextParsed.toString()
        pageCount++
      } catch (err) {
        console.error(`[Coverage] SerpApi error (q="${q}", page=${pageCount + 1}):`, err)
        throw err
      }
    }
  }

  console.log(`[Coverage] Found ${articles.length} articles`)
  return articles
}
