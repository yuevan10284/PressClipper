'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Navbar } from '@/components/layout/navbar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { formatRelativeTime } from '@/lib/utils'

interface Client {
  id: string
  name: string
  description: string | null
  created_at: string
  alerts_count: number
  last_run: {
    id: string
    status: string
    finished_at: string | null
  } | null
}

export default function DashboardPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchClients()
  }, [])

  const fetchClients = async () => {
    try {
      const res = await fetch('/api/clients')
      if (!res.ok) throw new Error('Failed to fetch clients')
      const data = await res.json()
      setClients(data.clients)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-brand-bg">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
            <p className="text-gray-600 mt-1">Manage your media monitoring clients</p>
          </div>
          <Link href="/clients/new">
            <Button>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Client
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="py-6">
                  <div className="h-5 bg-gray-200 rounded w-1/2 mb-3" />
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-red-600">{error}</p>
              <Button variant="outline" className="mt-4" onClick={fetchClients}>
                Try again
              </Button>
            </CardContent>
          </Card>
        ) : clients.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No clients yet</h3>
              <p className="text-gray-600 mb-6">Create your first client to start monitoring media coverage.</p>
              <Link href="/clients/new">
                <Button>Create your first client</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clients.map((client) => (
              <Link key={client.id} href={`/clients/${client.id}`}>
                <Card className="hover:border-brand-blue hover:shadow-md transition-all cursor-pointer h-full">
                  <CardContent className="py-5">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold text-gray-900 truncate">{client.name}</h3>
                      {client.last_run && (
                        <StatusBadge status={client.last_run.status} />
                      )}
                    </div>
                    {client.description && (
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{client.description}</p>
                    )}
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span>{client.alerts_count} alert{client.alerts_count !== 1 ? 's' : ''}</span>
                      {client.last_run?.finished_at && (
                        <span>Last run {formatRelativeTime(client.last_run.finished_at)}</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
