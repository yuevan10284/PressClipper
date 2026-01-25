import { NextRequest, NextResponse } from 'next/server'
import { getUserAndOrg } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

// POST /api/runs/:runId/cancel - Cancel a run
export async function POST(
  request: NextRequest,
  { params }: { params: { runId: string } }
) {
  try {
    const userOrg = await getUserAndOrg()
    if (!userOrg) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceClient()
    
    // Only cancel if it's QUEUED or RUNNING
    const { data: run, error: fetchError } = await supabase
      .from('runs')
      .select('*')
      .eq('id', params.runId)
      .eq('org_id', userOrg.orgId)
      .single()

    if (fetchError || !run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }

    if (run.status !== 'QUEUED' && run.status !== 'RUNNING') {
      return NextResponse.json({ error: 'Run is not active' }, { status: 400 })
    }

    // Mark as failed/cancelled
    const { error: updateError } = await supabase
      .from('runs')
      .update({
        status: 'FAILED',
        finished_at: new Date().toISOString(),
        error_message: 'Cancelled by user'
      })
      .eq('id', params.runId)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to cancel run' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in POST /api/runs/:runId/cancel:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
