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

// High-authority news sources (tier 1: 90-100, tier 2: 75-89, tier 3: 60-74)
const SOURCE_AUTHORITY: Record<string, number> = {
  // Tier 1 - Major national/international outlets
  'nytimes.com': 95, 'washingtonpost.com': 95, 'wsj.com': 95,
  'bbc.com': 95, 'bbc.co.uk': 95, 'reuters.com': 95, 'apnews.com': 95,
  'cnn.com': 90, 'nbcnews.com': 90, 'cbsnews.com': 90, 'abcnews.go.com': 90,
  'theguardian.com': 90, 'economist.com': 90, 'bloomberg.com': 92,
  'forbes.com': 88, 'fortune.com': 88, 'businessinsider.com': 85,
  
  // Tier 2 - Major regional/specialty outlets
  'usatoday.com': 82, 'latimes.com': 85, 'chicagotribune.com': 82,
  'sfchronicle.com': 80, 'bostonglobe.com': 82, 'nypost.com': 75,
  'politico.com': 85, 'thehill.com': 80, 'axios.com': 82,
  'techcrunch.com': 80, 'wired.com': 80, 'theverge.com': 78,
  'variety.com': 80, 'hollywoodreporter.com': 80, 'deadline.com': 78,
  'espn.com': 80, 'si.com': 78, 'bleacherreport.com': 72,
  
  // Tier 3 - Other known sources
  'huffpost.com': 70, 'buzzfeednews.com': 68, 'vox.com': 72,
  'slate.com': 70, 'salon.com': 65, 'dailymail.co.uk': 60,
  'foxnews.com': 75, 'msnbc.com': 75, 'npr.org': 88,
  'pbs.org': 85, 'time.com': 82, 'newsweek.com': 75,
}

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

/**
 * Calculate relevance score based on:
 * 1. Search position (higher rank = more relevant)
 * 2. Keyword match in title (boost if query words appear)
 */
function calculateRelevanceScore(
  position: number,
  title: string,
  query: string
): number {
  // Base score from position (position 1 = 90, position 10 = 72, position 50 = 40)
  // Using logarithmic decay: score = 100 - (log2(position) * 10)
  const positionScore = Math.max(30, Math.min(95, 100 - Math.log2(position + 1) * 15))
  
  // Keyword match boost (0-15 points)
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2)
  const titleLower = title.toLowerCase()
  const matchedWords = queryWords.filter(word => titleLower.includes(word))
  const keywordBoost = queryWords.length > 0 
    ? (matchedWords.length / queryWords.length) * 15 
    : 0
  
  // Exact phrase match bonus (5 points)
  const phraseBonus = titleLower.includes(query.toLowerCase()) ? 5 : 0
  
  const finalScore = Math.min(100, Math.round(positionScore + keywordBoost + phraseBonus))
  return finalScore
}

/**
 * Calculate importance score based on:
 * 1. Source authority (known outlets get higher scores)
 * 2. Recency (recent articles slightly boosted)
 */
function calculateImportanceScore(
  url: string,
  publishedAt: string | null
): number {
  // Get domain from URL
  let domain = ''
  try {
    const parsed = new URL(url)
    domain = parsed.hostname.replace('www.', '')
  } catch {
    domain = ''
  }
  
  // Source authority score (default 50 for unknown sources)
  const authorityScore = SOURCE_AUTHORITY[domain] || 50
  
  // Recency boost (0-10 points for articles in last 24h)
  let recencyBoost = 0
  if (publishedAt) {
    const hoursAgo = (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60)
    if (hoursAgo <= 6) recencyBoost = 10
    else if (hoursAgo <= 12) recencyBoost = 7
    else if (hoursAgo <= 24) recencyBoost = 4
  }
  
  const finalScore = Math.min(100, Math.round(authorityScore + recencyBoost))
  return finalScore
}

function itemToArticle(
  item: SerpApiOrganicItem,
  query: string,
  globalPosition: number
): CoverageArticle {
  const url = item.link || ''
  let outlet: string | undefined = item.source?.trim() || undefined
  if (!outlet && url) {
    try {
      outlet = new URL(url).hostname.replace('www.', '')
    } catch {
      outlet = undefined
    }
  }
  let published_at: string | null = null
  if (item.date) {
    const d = new Date(item.date)
    if (!isNaN(d.getTime())) published_at = d.toISOString()
  }
  
  const title = item.title ?? ''
  const relevance_score = calculateRelevanceScore(globalPosition, title, query)
  const importance_score = calculateImportanceScore(url, published_at)
  
  return {
    url,
    canonical_url: url,
    title: title || undefined,
    outlet,
    published_at,
    snippet: item.snippet ?? undefined,
    summary: undefined,
    relevance_score,
    importance_score,
    labels: []
  }
}

/**
 * Fetches coverage articles using SerpApi (serpapi.com).
 * One search per alert; each query is sent as-is (no added quotes or AND).
 * Paginates per query; results are merged and deduped by link.
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
    console.log(`[Coverage] Searching for: ${q}`)

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
          const position = item.position || (pageCount * 10 + organic.indexOf(item) + 1)
          articles.push(itemToArticle(item, q, position))
        }

        const pagination = data.serpapi_pagination
        const nextLink = pagination?.next ?? pagination?.next_link
        if (!nextLink || !nextLink.trim()) break

        const nextParsed = new URL(nextLink)
        nextParsed.searchParams.set('api_key', SERPAPI_KEY)
        // SerpApi forbids location + uule together; pagination next link may include uule
        nextParsed.searchParams.delete('location')
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
