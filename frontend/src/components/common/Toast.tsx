/**
 * Toast/Notification Component
 *
 * A comprehensive toast notification system with:
 * - Multiple types (success, error, warning, info)
 * - Auto-dismiss functionality
 * - Dark theme styling with colored borders
 * - Smooth animations
 * - useToast hook for easy usage
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react'
import { cn } from '../../utils/cn'

// Toast types
export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  message: string
  duration?: number
}

interface ToastContextValue {
  toasts: Toast[]
  addToast: (type: ToastType, message: string, duration?: number) => void
  removeToast: (id: string) => void
  success: (message: string, duration?: number) => void
  error: (message: string, duration?: number) => void
  warning: (message: string, duration?: number) => void
  info: (message: string, duration?: number) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

// Toast Provider
export interface ToastProviderProps {
  children: ReactNode
  defaultDuration?: number
}

export function ToastProvider({ children, defaultDuration = 5000 }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const addToast = useCallback((type: ToastType, message: string, duration?: number) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const toast: Toast = {
      id,
      type,
      message,
      duration: duration ?? defaultDuration,
    }

    setToasts((prev) => [...prev, toast])

    // Auto-dismiss
    if (toast.duration && toast.duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, toast.duration)
    }
  }, [defaultDuration, removeToast])

  const success = useCallback((message: string, duration?: number) => {
    addToast('success', message, duration)
  }, [addToast])

  const error = useCallback((message: string, duration?: number) => {
    addToast('error', message, duration)
  }, [addToast])

  const warning = useCallback((message: string, duration?: number) => {
    addToast('warning', message, duration)
  }, [addToast])

  const info = useCallback((message: string, duration?: number) => {
    addToast('info', message, duration)
  }, [addToast])

  const value: ToastContextValue = {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  )
}

// useToast hook
export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

// Toast Container
function ToastContainer() {
  const { toasts } = useToast()

  return (
    <div
      className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  )
}

// Individual Toast Item
interface ToastItemProps {
  toast: Toast
}

function ToastItem({ toast }: ToastItemProps) {
  const { removeToast } = useToast()
  const [isExiting, setIsExiting] = useState(false)

  const handleClose = () => {
    setIsExiting(true)
    setTimeout(() => {
      removeToast(toast.id)
    }, 300) // Match animation duration
  }

  // Toast type configurations
  const typeConfig = {
    success: {
      icon: CheckCircle,
      borderClass: 'border-green-500/50',
      bgClass: 'bg-green-500/10',
      iconClass: 'text-green-400',
      textClass: 'text-green-100',
    },
    error: {
      icon: XCircle,
      borderClass: 'border-red-500/50',
      bgClass: 'bg-red-500/10',
      iconClass: 'text-red-400',
      textClass: 'text-red-100',
    },
    warning: {
      icon: AlertCircle,
      borderClass: 'border-yellow-500/50',
      bgClass: 'bg-yellow-500/10',
      iconClass: 'text-yellow-400',
      textClass: 'text-yellow-100',
    },
    info: {
      icon: Info,
      borderClass: 'border-blue-500/50',
      bgClass: 'bg-blue-500/10',
      iconClass: 'text-blue-400',
      textClass: 'text-blue-100',
    },
  }

  const config = typeConfig[toast.type]
  const Icon = config.icon

  return (
    <div
      className={cn(
        'pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-lg border backdrop-blur-sm',
        'shadow-lg shadow-black/20 min-w-[320px] max-w-[480px]',
        'bg-slate-800/90',
        config.borderClass,
        config.bgClass,
        // Animation classes
        isExiting
          ? 'animate-toast-exit'
          : 'animate-toast-enter'
      )}
      role="alert"
    >
      <Icon className={cn('w-5 h-5 flex-shrink-0 mt-0.5', config.iconClass)} />

      <p className={cn('text-sm font-medium flex-1', config.textClass)}>
        {toast.message}
      </p>

      <button
        onClick={handleClose}
        className={cn(
          'flex-shrink-0 p-0.5 rounded transition-colors',
          'hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20',
          config.iconClass
        )}
        aria-label="Close notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

// CSS Animations (add to your global CSS or tailwind config)
// You can add these to your tailwind.config.js:
/*
  theme: {
    extend: {
      keyframes: {
        'toast-enter': {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'toast-exit': {
          '0%': { transform: 'translateX(0)', opacity: '1' },
          '100%': { transform: 'translateX(100%)', opacity: '0' },
        },
      },
      animation: {
        'toast-enter': 'toast-enter 0.3s ease-out',
        'toast-exit': 'toast-exit 0.3s ease-in',
      },
    },
  },
*/
