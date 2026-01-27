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

const SERPER_KEY = process.env.SERPER_KEY!
const SERPER_URL = 'https://google.serper.dev/search'

interface SerperOrganicItem {
  link: string
  title?: string
  snippet?: string
  date?: string
  position?: number
}

interface SerperResponse {
  organic?: SerperOrganicItem[]
}

function itemToArticle(item: SerperOrganicItem): CoverageArticle {
  const url = item.link || ''
  let outlet: string | undefined
  try {
    outlet = url ? new URL(url).hostname : undefined
  } catch {
    outlet = undefined
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
 * Fetches coverage articles using Serper API.
 * For each alert with non-empty query, POSTs to google.serper.dev/search with q, tbs=qdr:d, page;
 * paginates until organic is empty or page > 10, maps to CoverageArticle and dedupes by link.
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

    for (let page = 1; page <= 10; page++) {
      try {
        const res = await fetch(SERPER_URL, {
          method: 'POST',
          headers: {
            'X-API-KEY': SERPER_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            q,
            tbs: 'qdr:d',
            gl: 'us',
            hl: 'en',
            autocorrect: false,
            page
          })
        })

        if (!res.ok) {
          const text = await res.text()
          console.error(`[Coverage] Serper error (q="${q}", page=${page}): ${res.status} ${text}`)
          throw new Error(`Serper error: ${res.status} ${text}`)
        }

        const data: SerperResponse = await res.json()
        const organic = data.organic ?? []
        if (organic.length === 0) break

        for (const item of organic) {
          const link = item.link
          if (!link || link.trim() === '' || seenUrls.has(link)) continue
          seenUrls.add(link)
          articles.push(itemToArticle(item))
        }

        if (organic.length < 10) break
      } catch (err) {
        console.error(`[Coverage] Serper error (q="${q}", page=${page}):`, err)
        throw err
      }
    }
  }

  console.log(`[Coverage] Found ${articles.length} articles`)
  return articles
}
