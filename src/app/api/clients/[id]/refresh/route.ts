import { NextRequest, NextResponse } from 'next/server'
import { verifyClientAccess } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchCoverage } from '../../../../../../worker/coverage'
import {
  getClientWithAlerts,
  computeSinceTs,
  upsertArticles,
  updateAlertsChecked
} from '../../../../../../worker/run'

// POST /api/clients/:id/refresh
// TEMPORARY: runs the same logic as the worker (fetchCoverage + upsert + update alerts) once, then creates a SUCCESS run.
// Previous behavior (queue run for worker) is commented out below.
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

    // --- TEMPORARY: run worker logic once (same as worker every 5000ms) ---
    let clientData: Awaited<ReturnType<typeof getClientWithAlerts>>
    try {
      clientData = await getClientWithAlerts(supabase, params.id)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      if (msg.includes('Client not found')) {
        return NextResponse.json({ error: 'Client not found' }, { status: 404 })
      }
      return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 })
    }

    const { alerts: alertList } = clientData

    if (alertList.length === 0) {
      const { data: run, error: runErr } = await supabase
        .from('runs')
        .insert({
          org_id: userOrg.orgId,
          client_id: params.id,
          status: 'SUCCESS',
          started_at: new Date().toISOString(),
          finished_at: new Date().toISOString()
        })
        .select('id')
        .single()

      if (runErr) {
        console.error('Error creating run:', runErr)
        return NextResponse.json({ error: 'Failed to create run record' }, { status: 500 })
      }

      return NextResponse.json({ run_id: run.id, status: 'SUCCESS' }, { status: 201 })
    }

    const sinceTs = computeSinceTs(alertList)
    const results = await fetchCoverage(userOrg.orgId, params.id, alertList, sinceTs)

    try {
      await upsertArticles(supabase, userOrg.orgId, params.id, results)
    } catch (err) {
      console.error('Error upserting articles:', err)
      return NextResponse.json({ error: 'Failed to save articles' }, { status: 500 })
    }

    try {
      await updateAlertsChecked(supabase, alertList.map(a => a.id))
    } catch (err) {
      console.error('Error updating alerts:', err)
    }

    // Always create a run record and return (whether we had results or not)
    const { data: run, error: runErr } = await supabase
      .from('runs')
      .insert({
        org_id: userOrg.orgId,
        client_id: params.id,
        status: 'SUCCESS',
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString()
      })
      .select('id')
      .single()

    if (runErr) {
      console.error('Error creating run:', runErr)
      return NextResponse.json({ error: 'Failed to create run record' }, { status: 500 })
    }

    return NextResponse.json({ run_id: run.id, status: 'SUCCESS' }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/clients/:id/refresh:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/* --- PREVIOUS: queue a run for the worker (swap with block above to restore) ---
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
*/
