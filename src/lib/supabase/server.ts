import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseKey || supabaseUrl === 'YOUR_SUPABASE_URL') {
    throw new Error('Supabase environment variables are not configured')
  }

  return createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch {
            // Handle cookies in Server Components
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch {
            // Handle cookies in Server Components
          }
        },
      },
    }
  )
}

// Service role client for server-side operations (bypasses RLS)
export function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !serviceKey || supabaseUrl === 'YOUR_SUPABASE_URL') {
    throw new Error('Supabase environment variables are not configured')
  }
  
  return createServerClient(
    supabaseUrl,
    serviceKey,
    {
      cookies: {
        get() { return undefined },
        set() {},
        remove() {},
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}
