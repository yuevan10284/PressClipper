import { type ClassValue, clsx } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

// Strip tracking parameters from URLs to create canonical URL
export function canonicalizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'gclid', 'fbclid', 'msclkid', 'mc_eid', 'yclid', 'ref', '_ga'
    ]
    
    trackingParams.forEach(param => {
      parsed.searchParams.delete(param)
    })
    
    // Remove hash if it looks like tracking
    if (parsed.hash && parsed.hash.includes('=')) {
      parsed.hash = ''
    }
    
    return parsed.toString()
  } catch {
    return url
  }
}

// Format relative time
export function formatRelativeTime(date: Date | string): string {
  const now = new Date()
  const then = new Date(date)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  
  return then.toLocaleDateString()
}

// Format date for display
export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}
