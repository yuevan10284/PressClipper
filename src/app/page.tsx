import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  // Check if Supabase is configured
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl || supabaseUrl === 'YOUR_SUPABASE_URL') {
    redirect('/login')
  }
  
  // Dynamic import to avoid build-time issues
  const { createClient } = await import('@/lib/supabase/server')
  
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      redirect('/dashboard')
    } else {
      redirect('/login')
    }
  } catch {
    redirect('/login')
  }
}
