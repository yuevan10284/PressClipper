import { NextRequest, NextResponse } from 'next/server'
import { verifyClientAccess } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

// POST /api/clients/:id/refresh - Queue a new run
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userOrg = await verifyClientAccess(params.id)
    if (!userOrg) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceClient()

    // Check if there's already a queued or running run for this client
    const { data: existingRun } = await supabase
      .from('runs')
      .select('id, status')
      .eq('client_id', params.id)
      .in('status', ['QUEUED', 'RUNNING'])
      .single()

    if (existingRun) {
      return NextResponse.json({ 
        error: 'A run is already in progress',
        run_id: existingRun.id 
      }, { status: 409 })
    }

    // Create a new queued run
    const { data: run, error } = await supabase
      .from('runs')
      .insert({
        org_id: userOrg.orgId,
        client_id: params.id,
        status: 'QUEUED'
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating run:', error)
      return NextResponse.json({ error: 'Failed to queue run' }, { status: 500 })
    }

    return NextResponse.json({ 
      run_id: run.id,
      status: run.status 
    }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/clients/:id/refresh:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
