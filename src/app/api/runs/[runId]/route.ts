import { NextRequest, NextResponse } from 'next/server'
import { getUserAndOrg } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

// GET /api/runs/:runId - Get run status
export async function GET(
  request: NextRequest,
  { params }: { params: { runId: string } }
) {
  try {
    const userOrg = await getUserAndOrg()
    if (!userOrg) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceClient()
    
    const { data: run, error } = await supabase
      .from('runs')
      .select('*')
      .eq('id', params.runId)
      .eq('org_id', userOrg.orgId)
      .single()

    if (error || !run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }

    return NextResponse.json({ run })
  } catch (error) {
    console.error('Error in GET /api/runs/:runId:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
