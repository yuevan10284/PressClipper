import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseKey || supabaseUrl === 'YOUR_SUPABASE_URL') {
    throw new Error('Supabase environment variables are not configured. Please update .env.local')
  }
  
  return createBrowserClient(supabaseUrl, supabaseKey)
}
