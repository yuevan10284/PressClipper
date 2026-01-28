import { cn } from '@/lib/utils'
import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
}

export function Card({ children, className }: CardProps) {
  return (
    <div className={cn(
      'glass-dark rounded-2xl shadow-soft',
      'border border-white/50',
      'transition-all duration-300 hover:shadow-soft-lg',
      className
    )}>
      {children}
    </div>
  )
}

export function CardHeader({ children, className }: CardProps) {
  return (
    <div className={cn('px-6 py-5 border-b border-gray-100/50', className)}>
      {children}
    </div>
  )
}

export function CardContent({ children, className }: CardProps) {
  return (
    <div className={cn('px-6 py-5', className)}>
      {children}
    </div>
  )
}

export function CardFooter({ children, className }: CardProps) {
  return (
    <div className={cn(
      'px-6 py-4 border-t border-gray-100/50',
      'bg-gradient-to-r from-brand-cream/50 to-brand-cream/30 rounded-b-2xl',
      className
    )}>
      {children}
    </div>
  )
}
