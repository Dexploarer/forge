/**
 * Input Components
 */

import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from 'react'
import { cn } from '../../utils/cn'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export function Input({ className, error = false, ...props }: InputProps) {
  return (
    <input
      className={cn(
        'w-full px-4 py-2 bg-slate-800 border rounded-lg text-white placeholder-gray-500',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
        'transition-all duration-200',
        error ? 'border-red-500 focus:ring-red-500' : 'border-slate-700',
        className
      )}
      {...props}
    />
  )
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
}

export function Textarea({ className, error = false, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        'w-full px-4 py-2 bg-slate-800 border rounded-lg text-white placeholder-gray-500',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
        'transition-all duration-200 min-h-[80px] resize-y',
        error ? 'border-red-500 focus:ring-red-500' : 'border-slate-700',
        className
      )}
      {...props}
    />
  )
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean
}

export function Select({ className, error = false, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        'w-full px-4 py-2 bg-slate-800 border rounded-lg text-white',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
        'transition-all duration-200 cursor-pointer',
        error ? 'border-red-500 focus:ring-red-500' : 'border-slate-700',
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
}
