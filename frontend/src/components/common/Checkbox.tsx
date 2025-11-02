/**
 * Checkbox Component
 */

import type { InputHTMLAttributes } from 'react'
import { Check } from 'lucide-react'
import { cn } from '../../utils/cn'

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
}

export function Checkbox({ className, label, checked, ...props }: CheckboxProps) {
  return (
    <label className="inline-flex items-center cursor-pointer group">
      <div className="relative">
        <input
          type="checkbox"
          className="sr-only peer"
          checked={checked}
          {...props}
        />
        <div
          className={cn(
            'w-5 h-5 border-2 rounded bg-slate-800 transition-all duration-200',
            'peer-focus:ring-2 peer-focus:ring-blue-500 peer-focus:ring-offset-2 peer-focus:ring-offset-slate-900',
            checked
              ? 'bg-blue-600 border-blue-600'
              : 'border-slate-600 group-hover:border-slate-500',
            className
          )}
        >
          {checked && (
            <Check size={16} className="text-white absolute inset-0" strokeWidth={3} />
          )}
        </div>
      </div>
      {label && (
        <span className="ml-2 text-sm text-gray-300 group-hover:text-white transition-colors">
          {label}
        </span>
      )}
    </label>
  )
}
