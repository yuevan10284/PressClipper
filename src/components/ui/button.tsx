'use client'

import { forwardRef, ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => {
    const baseStyles = cn(
      'inline-flex items-center justify-center font-semibold rounded-xl',
      'transition-all duration-200 ease-out',
      'focus:outline-none focus:ring-2 focus:ring-offset-2',
      'disabled:opacity-50 disabled:pointer-events-none disabled:transform-none',
      'active:scale-[0.98]'
    )
    
    const variants = {
      primary: cn(
        'bg-gradient-to-r from-brand-blue to-primary-400 text-white',
        'hover:from-primary-600 hover:to-brand-blue hover:shadow-glow',
        'hover:-translate-y-0.5',
        'focus:ring-brand-blue'
      ),
      secondary: cn(
        'bg-gradient-to-r from-brand-cream to-brand-cream/80 text-gray-800',
        'hover:from-brand-cream/90 hover:to-brand-cream',
        'border border-brand-cream',
        'focus:ring-brand-blue'
      ),
      outline: cn(
        'border-2 border-gray-200 bg-white/50 text-gray-700',
        'hover:border-brand-blue hover:text-brand-blue hover:bg-white',
        'focus:ring-brand-blue'
      ),
      ghost: cn(
        'text-gray-600 bg-transparent',
        'hover:bg-brand-cream/50 hover:text-gray-900',
        'focus:ring-gray-500'
      ),
      danger: cn(
        'bg-gradient-to-r from-red-500 to-red-600 text-white',
        'hover:from-red-600 hover:to-red-700 hover:shadow-lg',
        'focus:ring-red-500'
      )
    }
    
    const sizes = {
      sm: 'px-3.5 py-1.5 text-sm',
      md: 'px-5 py-2.5 text-sm',
      lg: 'px-7 py-3.5 text-base'
    }

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        )}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
