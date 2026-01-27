import { NextRequest, NextResponse } from 'next/server'
import { verifyClientAccess } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

// POST /api/clients/:id/alerts - Add a search-term alert
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userOrg = await verifyClientAccess(params.id)
    if (!userOrg) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { query, label } = body

    if (typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json({ error: 'Search term is required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const { data: alert, error } = await supabase
      .from('alerts')
      .insert({
        client_id: params.id,
        query: query.trim(),
        label: label?.trim() || null,
        active: true
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating alert:', error)
      return NextResponse.json({ error: 'Failed to add alert' }, { status: 500 })
    }

    // Update client's updated_at
    await supabase
      .from('clients')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', params.id)

    return NextResponse.json({ alert }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/clients/:id/alerts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/clients/:id/alerts/:alertId
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userOrg = await verifyClientAccess(params.id)
    if (!userOrg) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const alertId = searchParams.get('alertId')

    if (!alertId) {
      return NextResponse.json({ error: 'Alert ID is required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const { error } = await supabase
      .from('alerts')
      .delete()
      .eq('id', alertId)
      .eq('client_id', params.id)

    if (error) {
      console.error('Error deleting alert:', error)
      return NextResponse.json({ error: 'Failed to delete alert' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/clients/:id/alerts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
