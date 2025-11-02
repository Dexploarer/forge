/**
 * Modal Components
 */

import type { HTMLAttributes, ReactNode } from 'react'
import { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../utils/cn'

export interface ModalProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
}

export function Modal({
  open,
  onClose,
  children,
  className,
  size = 'md',
}: ModalProps) {
  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[95vw]',
  }

  useEffect(() => {
    if (open) {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose()
        }
      }

      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'

      return () => {
        document.removeEventListener('keydown', handleEscape)
        document.body.style.overflow = ''
      }
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        className={cn(
          'w-full bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col max-h-[90vh]',
          'animate-scale-in',
          sizes[size],
          className
        )}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>
  )
}

export interface ModalHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title?: string
  onClose?: () => void
}

export function ModalHeader({ className, title, onClose, children, ...props }: ModalHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between p-6 border-b border-slate-700',
        className
      )}
      {...props}
    >
      {title ? (
        <h2 className="text-xl font-semibold text-white">{title}</h2>
      ) : (
        children
      )}
      {onClose && (
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="Close modal"
        >
          <X size={20} />
        </button>
      )}
    </div>
  )
}

export interface ModalBodyProps extends HTMLAttributes<HTMLDivElement> {
  noPadding?: boolean
}

export function ModalBody({ className, noPadding = false, ...props }: ModalBodyProps) {
  return (
    <div
      className={cn(
        'flex-1 overflow-y-auto',
        !noPadding && 'p-6',
        className
      )}
      {...props}
    />
  )
}

export interface ModalFooterProps extends HTMLAttributes<HTMLDivElement> {}

export function ModalFooter({ className, ...props }: ModalFooterProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-3 p-6 border-t border-slate-700',
        className
      )}
      {...props}
    />
  )
}
