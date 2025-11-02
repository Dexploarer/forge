/**
 * Tabs Component
 */

import { createContext, useContext, type HTMLAttributes, type ReactNode } from 'react'
import { cn } from '../../utils/cn'

interface TabsContextValue {
  value: string
  onValueChange: (value: string) => void
}

const TabsContext = createContext<TabsContextValue | undefined>(undefined)

function useTabsContext() {
  const context = useContext(TabsContext)
  if (!context) {
    throw new Error('Tabs compound components must be used within Tabs')
  }
  return context
}

export interface TabsProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value: string
  onValueChange: (value: string) => void
  children: ReactNode
}

export function Tabs({ value, onValueChange, className, children, ...props }: TabsProps) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={cn('w-full', className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

export interface TabsListProps extends HTMLAttributes<HTMLDivElement> {}

export function TabsList({ className, children, ...props }: TabsListProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-lg bg-slate-800/50 border border-slate-700/50 p-1',
        'backdrop-blur-sm',
        className
      )}
      role="tablist"
      {...props}
    >
      {children}
    </div>
  )
}

export interface TabsTriggerProps extends Omit<HTMLAttributes<HTMLButtonElement>, 'onClick'> {
  value: string
  disabled?: boolean
}

export function TabsTrigger({
  value: triggerValue,
  disabled = false,
  className,
  children,
  ...props
}: TabsTriggerProps) {
  const { value, onValueChange } = useTabsContext()
  const isActive = value === triggerValue

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      disabled={disabled}
      onClick={() => !disabled && onValueChange(triggerValue)}
      className={cn(
        'inline-flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium',
        'transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        isActive
          ? 'bg-blue-600 text-white shadow-sm'
          : 'text-gray-400 hover:text-white hover:bg-slate-700/50',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export interface TabsContentProps extends HTMLAttributes<HTMLDivElement> {
  value: string
  forceMount?: boolean
}

export function TabsContent({
  value: contentValue,
  forceMount = false,
  className,
  children,
  ...props
}: TabsContentProps) {
  const { value } = useTabsContext()
  const isActive = value === contentValue

  if (!isActive && !forceMount) {
    return null
  }

  return (
    <div
      role="tabpanel"
      hidden={!isActive}
      className={cn(
        'mt-4 focus:outline-none',
        !isActive && 'hidden',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
