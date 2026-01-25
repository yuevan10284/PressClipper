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
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/dashboard" className="flex items-center">
              <span className="text-xl font-bold text-gray-900">PressClipper</span>
            </Link>
            <div className="hidden sm:ml-8 sm:flex sm:space-x-4">
              <Link 
                href="/dashboard" 
                className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-md hover:bg-gray-50"
              >
                Dashboard
              </Link>
            </div>
          </div>
          <div className="flex items-center">
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
        </div>
      </div>
    </nav>
  )
}
