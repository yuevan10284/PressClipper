'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/layout/navbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { formatRelativeTime, formatDate } from '@/lib/utils'
import jsPDF from 'jspdf'

interface Alert {
  id: string
  rss_url: string
  label: string | null
  active: boolean
  last_checked_at: string | null
  created_at: string
}

interface Run {
  id: string
  status: string
  started_at: string | null
  finished_at: string | null
  error_message: string | null
  created_at: string
}

interface Client {
  id: string
  name: string
  description: string | null
  alerts: Alert[]
  runs: Run[]
  last_run: Run | null
}

interface Article {
  id: string
  title: string
  url: string
  outlet: string | null
  published_at: string | null
  snippet: string | null
  summary: string | null
  relevance_score: number
  importance_score: number
  labels: string[]
}

export default function ClientDetailPage({ params }: { params: { id: string } }) {
  const [client, setClient] = useState<Client | null>(null)
  const [articles, setArticles] = useState<Article[]>([])
  const [articlesTotal, setArticlesTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [currentRunId, setCurrentRunId] = useState<string | null>(null)
  const [error, setError] = useState('')
  
  // Alert form
  const [newRssUrl, setNewRssUrl] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [addingAlert, setAddingAlert] = useState(false)
  
  // Filters
  const [datePreset, setDatePreset] = useState<'24h' | '7d' | '30d' | 'custom'>('7d')
  const [searchQuery, setSearchQuery] = useState('')
  const [minScore, setMinScore] = useState('')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  
  const router = useRouter()

  const fetchClient = useCallback(async () => {
    try {
      const res = await fetch(`/api/clients/${params.id}`)
      if (!res.ok) throw new Error('Failed to fetch client')
      const data = await res.json()
      setClient(data.client)
      
      // Check for running/queued run
      const activeRun = data.client.runs?.find(
        (r: Run) => r.status === 'RUNNING' || r.status === 'QUEUED'
      )
      if (activeRun) {
        setCurrentRunId(activeRun.id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    }
  }, [params.id])

  const fetchCoverage = useCallback(async () => {
    try {
      const queryParams = new URLSearchParams()
      
      // Calculate date range from preset
      const now = new Date()
      let from: Date | null = null
      
      if (datePreset === '24h') {
        from = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      } else if (datePreset === '7d') {
        from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      } else if (datePreset === '30d') {
        from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      } else if (datePreset === 'custom') {
        if (customFrom) queryParams.set('from', customFrom)
        if (customTo) queryParams.set('to', customTo)
      }
      
      if (from && datePreset !== 'custom') {
        queryParams.set('from', from.toISOString())
      }
      
      if (searchQuery) queryParams.set('q', searchQuery)
      if (minScore) queryParams.set('minScore', minScore)
      
      const res = await fetch(`/api/clients/${params.id}/coverage?${queryParams}`)
      if (!res.ok) throw new Error('Failed to fetch coverage')
      const data = await res.json()
      setArticles(data.articles)
      setArticlesTotal(data.total)
    } catch (err) {
      console.error('Error fetching coverage:', err)
    }
  }, [params.id, datePreset, searchQuery, minScore, customFrom, customTo])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await Promise.all([fetchClient(), fetchCoverage()])
      setLoading(false)
    }
    load()
  }, [fetchClient, fetchCoverage])

  // Poll for run status when there's an active run
  useEffect(() => {
    if (!currentRunId) return

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/runs/${currentRunId}`)
        if (!res.ok) return
        
        const data = await res.json()
        if (data.run.status === 'SUCCESS' || data.run.status === 'FAILED') {
          setCurrentRunId(null)
          setRefreshing(false)
          // Refresh data
          fetchClient()
          fetchCoverage()
        }
      } catch (err) {
        console.error('Error polling run status:', err)
      }
    }, 2000)

    return () => clearInterval(pollInterval)
  }, [currentRunId, fetchClient, fetchCoverage])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const res = await fetch(`/api/clients/${params.id}/refresh`, {
        method: 'POST'
      })
      
      if (!res.ok) {
        const data = await res.json()
        if (data.run_id) {
          setCurrentRunId(data.run_id)
        }
        throw new Error(data.error || 'Failed to start refresh')
      }
      
      const data = await res.json()
      setCurrentRunId(data.run_id)
      fetchClient()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setRefreshing(false)
    }
  }

  const handleCancelRun = async () => {
    if (!currentRunId) return
    
    try {
      const res = await fetch(`/api/runs/${currentRunId}/cancel`, {
        method: 'POST'
      })
      
      if (!res.ok) {
        throw new Error('Failed to cancel run')
      }
      
      setCurrentRunId(null)
      setRefreshing(false)
      fetchClient()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  const handleAddAlert = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddingAlert(true)
    
    try {
      const res = await fetch(`/api/clients/${params.id}/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rss_url: newRssUrl, label: newLabel })
      })
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to add alert')
      }
      
      setNewRssUrl('')
      setNewLabel('')
      fetchClient()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setAddingAlert(false)
    }
  }

  const handleDeleteAlert = async (alertId: string) => {
    if (!confirm('Are you sure you want to delete this alert?')) return
    
    try {
      const res = await fetch(`/api/clients/${params.id}/alerts?alertId=${alertId}`, {
        method: 'DELETE'
      })
      
      if (!res.ok) throw new Error('Failed to delete alert')
      fetchClient()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  const handleExportCSV = () => {
    if (articles.length === 0) return
    
    const headers = ['Title', 'Outlet', 'Published Date', 'URL', 'Relevance Score', 'Importance Score']
    const rows = articles.map(article => [
      article.title || 'Untitled',
      article.outlet || '',
      article.published_at ? formatDate(article.published_at) : '',
      article.url,
      article.relevance_score.toString(),
      article.importance_score.toString()
    ])
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${client?.name || 'coverage'}-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const handleExportPDF = () => {
    if (articles.length === 0 || !client) return
    
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.width
    const pageHeight = doc.internal.pageSize.height
    const margin = 20
    const contentWidth = pageWidth - margin * 2
    
    // Title
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(37, 98, 209) // brand-blue
    doc.text(`${client.name} - Coverage Report`, margin, 25)
    
    // Subtitle with date
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100)
    doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, margin, 33)
    
    let yPos = 50
    
    // Articles list
    articles.forEach((article) => {
      // Check if we need a new page
      if (yPos > pageHeight - 40) {
        doc.addPage()
        yPos = 25
      }
      
      // Format date
      const dateStr = article.published_at 
        ? new Date(article.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        : 'Unknown Date'
      
      // Outlet - Date - Title line
      const outlet = (article.outlet || 'Unknown Outlet').toUpperCase()
      const title = article.title || 'Untitled'
      const headerLine = `${outlet} – ${dateStr} – ${title}`
      
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(0, 0, 0)
      
      // Word wrap the header line
      const headerLines = doc.splitTextToSize(headerLine, contentWidth)
      doc.text(headerLines, margin, yPos)
      yPos += headerLines.length * 5
      
      // URL line (hyperlinked)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(37, 98, 209) // brand-blue for link
      doc.textWithLink(article.url, margin, yPos, { url: article.url })
      yPos += 18 // Blank line spacing before next article
    })
    
    doc.save(`${client.name}-coverage-${new Date().toISOString().split('T')[0]}.pdf`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-bg">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4" />
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-8" />
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-1 h-64 bg-gray-200 rounded-xl" />
              <div className="lg:col-span-2 h-96 bg-gray-200 rounded-xl" />
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-brand-bg">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-red-600">Client not found</p>
              <Button variant="outline" className="mt-4" onClick={() => router.push('/dashboard')}>
                Back to Dashboard
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-bg">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <button 
            onClick={() => router.push('/dashboard')}
            className="text-gray-600 hover:text-gray-900 flex items-center text-sm mb-4"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </button>
          
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
              {client.description && (
                <p className="text-gray-600 mt-1">{client.description}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {currentRunId ? (
                <>
                  <div className="flex items-center gap-2 px-4 py-2 bg-brand-cream rounded-lg">
                    <svg className="animate-spin h-4 w-4 text-brand-blue" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span className="text-sm font-medium text-gray-700">Processing...</span>
                  </div>
                  <Button 
                    onClick={handleCancelRun} 
                    variant="danger"
                    size="sm"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Cancel
                  </Button>
                </>
              ) : (
                <Button 
                  onClick={handleRefresh} 
                  loading={refreshing}
                  disabled={refreshing}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh Now
                </Button>
              )}
            </div>
          </div>
          
          {/* Run Status */}
          {client.last_run && (
            <div className="mt-4 flex items-center gap-4 text-sm">
              <StatusBadge status={client.last_run.status} />
              {client.last_run.finished_at && (
                <span className="text-gray-500">
                  Last run completed {formatRelativeTime(client.last_run.finished_at)}
                </span>
              )}
              {client.last_run.error_message && (
                <span className="text-red-600">{client.last_run.error_message}</span>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 text-red-700">
            {error}
            <button onClick={() => setError('')} className="ml-2 font-medium underline">
              Dismiss
            </button>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Alerts */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <h2 className="font-semibold text-gray-900">Google Alerts RSS Feeds</h2>
              </CardHeader>
              <CardContent className="space-y-4">
                {client.alerts.length === 0 ? (
                  <p className="text-sm text-gray-500">No alerts configured yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {client.alerts.map((alert) => (
                      <li key={alert.id} className="flex items-start justify-between gap-2 p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1 min-w-0">
                          {alert.label && (
                            <p className="font-medium text-gray-900 text-sm">{alert.label}</p>
                          )}
                          <p className="text-xs text-gray-500 truncate">{alert.rss_url}</p>
                          {alert.last_checked_at && (
                            <p className="text-xs text-gray-400 mt-1">
                              Checked {formatRelativeTime(alert.last_checked_at)}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteAlert(alert.id)}
                          className="text-gray-400 hover:text-red-600 p-1"
                          title="Delete alert"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                
                {/* Add Alert Form */}
                <form onSubmit={handleAddAlert} className="pt-4 border-t border-gray-100">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Add New Alert</h3>
                  <div className="space-y-3">
                    <Input
                      id="rss_url"
                      type="url"
                      placeholder="https://google.com/alerts/feeds/..."
                      value={newRssUrl}
                      onChange={(e) => setNewRssUrl(e.target.value)}
                      required
                    />
                    <Input
                      id="label"
                      type="text"
                      placeholder="Label (optional)"
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                    />
                    <Button type="submit" size="sm" className="w-full" loading={addingAlert}>
                      Add Alert
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Coverage Feed */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900">Coverage Feed</h2>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500">{articlesTotal} articles</span>
                    {articles.length > 0 && (
                      <div className="flex gap-2">
                        <button
                          onClick={handleExportCSV}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                          title="Export as CSV"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          CSV
                        </button>
                        <button
                          onClick={handleExportPDF}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-brand-blue hover:bg-blue-700 rounded-lg transition-colors"
                          title="Export as PDF"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          PDF
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Filters */}
                <div className="mt-4 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {(['24h', '7d', '30d', 'custom'] as const).map((preset) => (
                      <button
                        key={preset}
                        onClick={() => setDatePreset(preset)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          datePreset === preset
                            ? 'bg-brand-cream text-brand-blue'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {preset === 'custom' ? 'Custom' : preset}
                      </button>
                    ))}
                  </div>
                  
                  {datePreset === 'custom' && (
                    <div className="flex gap-2">
                      <Input
                        type="date"
                        value={customFrom}
                        onChange={(e) => setCustomFrom(e.target.value)}
                        placeholder="From"
                      />
                      <Input
                        type="date"
                        value={customTo}
                        onChange={(e) => setCustomTo(e.target.value)}
                        placeholder="To"
                      />
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        type="text"
                        placeholder="Search articles..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <div className="w-32">
                      <Input
                        type="number"
                        placeholder="Min score"
                        value={minScore}
                        onChange={(e) => setMinScore(e.target.value)}
                        min={0}
                        max={100}
                      />
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="divide-y divide-gray-100">
                {articles.length === 0 ? (
                  <div className="py-12 text-center">
                    <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                    </svg>
                    <p className="text-gray-500">No coverage found</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Try adjusting your filters or run a refresh to fetch new articles.
                    </p>
                  </div>
                ) : (
                  articles.map((article) => (
                    <article key={article.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <a
                            href={article.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-gray-900 hover:text-brand-blue line-clamp-2"
                          >
                            {article.title || 'Untitled'}
                          </a>
                          <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                            {article.outlet && (
                              <span className="font-medium">{article.outlet}</span>
                            )}
                            {article.outlet && article.published_at && <span>•</span>}
                            {article.published_at && (
                              <span>{formatDate(article.published_at)}</span>
                            )}
                          </div>
                          {article.snippet && (
                            <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                              {article.snippet}
                            </p>
                          )}
                          {article.summary && (
                            <p className="mt-2 text-sm text-gray-700 bg-gray-50 p-2 rounded">
                              {article.summary}
                            </p>
                          )}
                          {article.labels && article.labels.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {article.labels.map((label, idx) => (
                                <Badge key={idx} variant="default">{label}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-500">Relevance</span>
                            <Badge variant={article.relevance_score >= 70 ? 'success' : article.relevance_score >= 40 ? 'warning' : 'default'}>
                              {article.relevance_score}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-500">Importance</span>
                            <Badge variant={article.importance_score >= 70 ? 'info' : 'default'}>
                              {article.importance_score}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
