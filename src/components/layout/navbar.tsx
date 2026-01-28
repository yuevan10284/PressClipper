'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

export function Navbar() {
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <nav className="sticky top-0 z-50 glass-dark border-b border-white/20 shadow-soft">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/dashboard" className="flex items-center group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-blue to-primary-400 flex items-center justify-center mr-3 shadow-sm group-hover:shadow-glow transition-shadow duration-300">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
              </div>
              <span className="text-xl font-bold gradient-text">PressClipper</span>
            </Link>
            <div className="hidden sm:ml-8 sm:flex sm:space-x-2">
              <Link 
                href="/dashboard" 
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-brand-blue rounded-xl hover:bg-brand-cream/50 transition-all duration-200"
              >
                Dashboard
              </Link>
            </div>
          </div>
          <div className="flex items-center">
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign out
            </Button>
          </div>
        </div>
      </div>
    </nav>
  )
}
