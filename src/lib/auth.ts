import { createClient, createServiceClient } from '@/lib/supabase/server'

export interface UserOrg {
  userId: string
  orgId: string
  email: string
}

// Get current user and their organization
export async function getUserAndOrg(): Promise<UserOrg | null> {
  const supabase = createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    return null
  }

  // Get the user's organization via membership
  const { data: membership, error: membershipError } = await supabase
    .from('memberships')
    .select('org_id')
    .eq('user_id', user.id)
    .single()

  if (membershipError || !membership) {
    return null
  }

  return {
    userId: user.id,
    orgId: membership.org_id,
    email: user.email || ''
  }
}

// Verify user has access to a specific client
export async function verifyClientAccess(clientId: string): Promise<UserOrg | null> {
  const userOrg = await getUserAndOrg()
  if (!userOrg) return null

  const supabase = createServiceClient()
  
  const { data: client } = await supabase
    .from('clients')
    .select('org_id')
    .eq('id', clientId)
    .single()

  if (!client || client.org_id !== userOrg.orgId) {
    return null
  }

  return userOrg
}
