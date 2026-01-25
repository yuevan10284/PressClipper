import { NextRequest, NextResponse } from 'next/server'
import { verifyClientAccess } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

// GET /api/clients/:id - Get client details with alerts and last run
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userOrg = await verifyClientAccess(params.id)
    if (!userOrg) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceClient()
    
    const { data: client, error } = await supabase
      .from('clients')
      .select(`
        *,
        alerts (*),
        runs (*)
      `)
      .eq('id', params.id)
      .single()

    if (error) {
      console.error('Error fetching client:', error)
      return NextResponse.json({ error: 'Failed to fetch client' }, { status: 500 })
    }

    // Sort runs by created_at desc and get the last one
    const sortedRuns = (client.runs || []).sort(
      (a: { created_at: string }, b: { created_at: string }) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    return NextResponse.json({
      client: {
        ...client,
        runs: sortedRuns,
        last_run: sortedRuns[0] || null
      }
    })
  } catch (error) {
    console.error('Error in GET /api/clients/:id:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/clients/:id - Delete a client
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userOrg = await verifyClientAccess(params.id)
    if (!userOrg) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceClient()
    
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', params.id)

    if (error) {
      console.error('Error deleting client:', error)
      return NextResponse.json({ error: 'Failed to delete client' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/clients/:id:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
