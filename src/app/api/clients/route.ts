import { NextRequest, NextResponse } from 'next/server'
import { getUserAndOrg } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

// GET /api/clients - List all clients for user's org
export async function GET() {
  try {
    const userOrg = await getUserAndOrg()
    if (!userOrg) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceClient()
    
    const { data: clients, error } = await supabase
      .from('clients')
      .select(`
        *,
        alerts (id),
        runs (id, status, finished_at)
      `)
      .eq('org_id', userOrg.orgId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching clients:', error)
      return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 })
    }

    // Transform to include counts and last run
    const transformedClients = clients.map(client => ({
      id: client.id,
      name: client.name,
      description: client.description,
      created_at: client.created_at,
      updated_at: client.updated_at,
      alerts_count: client.alerts?.length || 0,
      last_run: client.runs?.[0] || null
    }))

    return NextResponse.json({ clients: transformedClients })
  } catch (error) {
    console.error('Error in GET /api/clients:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/clients - Create a new client
export async function POST(request: NextRequest) {
  try {
    const userOrg = await getUserAndOrg()
    if (!userOrg) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const supabase = createServiceClient()
    
    const { data: client, error } = await supabase
      .from('clients')
      .insert({
        org_id: userOrg.orgId,
        name: name.trim(),
        description: description?.trim() || null
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating client:', error)
      return NextResponse.json({ error: 'Failed to create client' }, { status: 500 })
    }

    return NextResponse.json({ client }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/clients:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
