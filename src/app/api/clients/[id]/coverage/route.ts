import { NextRequest, NextResponse } from 'next/server'
import { verifyClientAccess } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

// GET /api/clients/:id/coverage - Get articles with filters
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userOrg = await verifyClientAccess(params.id)
    if (!userOrg) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const q = searchParams.get('q')
    const minScore = searchParams.get('minScore')
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    const supabase = createServiceClient()
    
    let query = supabase
      .from('articles')
      .select('*', { count: 'exact' })
      .eq('client_id', params.id)
      .order('published_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1)

    // Apply date filters
    if (from) {
      query = query.gte('published_at', from)
    }
    if (to) {
      query = query.lte('published_at', to)
    }

    // Apply minimum relevance score filter
    if (minScore) {
      const score = parseInt(minScore, 10)
      if (!isNaN(score)) {
        query = query.gte('relevance_score', score)
      }
    }

    // Apply text search (searches title, outlet, snippet)
    if (q && q.trim()) {
      const searchTerm = `%${q.trim()}%`
      query = query.or(`title.ilike.${searchTerm},outlet.ilike.${searchTerm},snippet.ilike.${searchTerm}`)
    }

    const { data: articles, error, count } = await query

    if (error) {
      console.error('Error fetching coverage:', error)
      return NextResponse.json({ error: 'Failed to fetch coverage' }, { status: 500 })
    }

    return NextResponse.json({ 
      articles,
      total: count,
      limit,
      offset
    })
  } catch (error) {
    console.error('Error in GET /api/clients/:id/coverage:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
