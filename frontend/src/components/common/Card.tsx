/**
 * Card Components
 */

import type { HTMLAttributes } from 'react'
import { cn } from '../../utils/cn'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'hover' | 'interactive'
  selected?: boolean
}

export function Card({
  className,
  variant = 'default',
  selected = false,
  children,
  ...props
}: CardProps) {
  const variants = {
    default: 'bg-slate-800/50 border-slate-700/50',
    hover: 'bg-slate-800/50 border-slate-700/50 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10 cursor-pointer',
    interactive: 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-700/50 cursor-pointer',
  }

  return (
    <div
      className={cn(
        'rounded-lg border backdrop-blur-sm transition-all duration-200',
        variants[variant],
        selected && 'border-blue-500 ring-2 ring-blue-500 ring-opacity-20 bg-blue-500/5',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {}

export function CardHeader({ className, ...props }: CardHeaderProps) {
  return (
    <div
      className={cn('px-6 py-4', className)}
      {...props}
    />
  )
}

export interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
}

export function CardTitle({ className, as: Component = 'h3', ...props }: CardTitleProps) {
  return (
    <Component
      className={cn('text-lg font-semibold text-white', className)}
      {...props}
    />
  )
}

export interface CardDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {}

export function CardDescription({ className, ...props }: CardDescriptionProps) {
  return (
    <p
      className={cn('text-sm text-gray-400 mt-1', className)}
      {...props}
    />
  )
}

export interface CardContentProps extends HTMLAttributes<HTMLDivElement> {}

export function CardContent({ className, ...props }: CardContentProps) {
  return (
    <div
      className={cn('px-6 py-4', className)}
      {...props}
    />
  )
}

export interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {}

export function CardFooter({ className, ...props }: CardFooterProps) {
  return (
    <div
      className={cn(
        'px-6 py-4 border-t border-slate-700/50 bg-slate-800/30 rounded-b-lg',
        className
      )}
      {...props}
    />
  )
}
