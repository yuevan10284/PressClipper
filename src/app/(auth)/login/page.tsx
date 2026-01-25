'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [message, setMessage] = useState('')
  
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/api/auth/callback`
          }
        })
        
        if (error) throw error
        setMessage('Check your email for the confirmation link!')
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        })
        
        if (error) throw error
        router.push('/dashboard')
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-brand-bg">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">PressClipper</h1>
          <p className="mt-2 text-gray-600">Monitor your media coverage</p>
        </div>
        
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-900">
              {mode === 'login' ? 'Sign in to your account' : 'Create your account'}
            </h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                id="email"
                type="email"
                label="Email address"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              
              <Input
                id="password"
                type="password"
                label="Password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
              
              {error && (
                <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">
                  {error}
                </div>
              )}
              
              {message && (
                <div className="p-3 rounded-lg bg-green-50 text-green-700 text-sm">
                  {message}
                </div>
              )}
              
              <Button type="submit" className="w-full" loading={loading}>
                {mode === 'login' ? 'Sign in' : 'Sign up'}
              </Button>
            </form>
            
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'login' ? 'signup' : 'login')
                  setError('')
                  setMessage('')
                }}
                className="text-sm text-brand-blue hover:text-primary-600"
              >
                {mode === 'login' 
                  ? "Don't have an account? Sign up" 
                  : 'Already have an account? Sign in'}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
