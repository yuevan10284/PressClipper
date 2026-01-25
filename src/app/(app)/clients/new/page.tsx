'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/layout/navbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export default function NewClientPage() {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create client')
      }

      const data = await res.json()
      router.push(`/clients/${data.client.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-brand-bg">
      <Navbar />
      
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <button 
            onClick={() => router.back()}
            className="text-gray-600 hover:text-gray-900 flex items-center text-sm"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        </div>
        
        <Card>
          <CardHeader>
            <h1 className="text-xl font-semibold text-gray-900">Create New Client</h1>
            <p className="text-sm text-gray-600 mt-1">
              Set up a new client to monitor their media coverage.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                id="name"
                label="Client Name"
                placeholder="e.g., Acme Corporation"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <textarea
                  id="description"
                  rows={3}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
                  placeholder="Brief description of this client..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              
              {error && (
                <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">
                  {error}
                </div>
              )}
              
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => router.back()}>
                  Cancel
                </Button>
                <Button type="submit" loading={loading}>
                  Create Client
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
