import { cn } from '@/lib/utils'
import { ReactNode } from 'react'

interface BadgeProps {
  children: ReactNode
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info'
  className?: string
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  const variants = {
    default: 'bg-brand-cream text-gray-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    error: 'bg-red-100 text-red-800',
    info: 'bg-blue-100 text-brand-blue'
  }

  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
      variants[variant],
      className
    )}>
      {children}
    </span>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const getVariant = () => {
    switch (status) {
      case 'SUCCESS':
        return 'success'
      case 'FAILED':
        return 'error'
      case 'RUNNING':
        return 'warning'
      case 'QUEUED':
        return 'info'
      default:
        return 'default'
    }
  }

  return <Badge variant={getVariant()}>{status}</Badge>
}
