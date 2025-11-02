/**
 * Table Components
 */

import type { HTMLAttributes, ThHTMLAttributes, TdHTMLAttributes } from 'react'
import { cn } from '../../utils/cn'

export interface TableProps extends HTMLAttributes<HTMLTableElement> {}

export function Table({ className, ...props }: TableProps) {
  return (
    <div className="w-full overflow-auto">
      <table
        className={cn(
          'w-full caption-bottom text-sm border-collapse',
          className
        )}
        {...props}
      />
    </div>
  )
}

export interface TableHeaderProps extends HTMLAttributes<HTMLTableSectionElement> {}

export function TableHeader({ className, ...props }: TableHeaderProps) {
  return (
    <thead
      className={cn(
        'border-b border-slate-700/50',
        className
      )}
      {...props}
    />
  )
}

export interface TableBodyProps extends HTMLAttributes<HTMLTableSectionElement> {}

export function TableBody({ className, ...props }: TableBodyProps) {
  return (
    <tbody
      className={cn(
        'divide-y divide-slate-700/50',
        className
      )}
      {...props}
    />
  )
}

export interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  hoverable?: boolean
}

export function TableRow({ className, hoverable = true, ...props }: TableRowProps) {
  return (
    <tr
      className={cn(
        'transition-colors duration-200',
        hoverable && 'hover:bg-slate-700/30',
        className
      )}
      {...props}
    />
  )
}

export interface TableHeadProps extends ThHTMLAttributes<HTMLTableCellElement> {}

export function TableHead({ className, ...props }: TableHeadProps) {
  return (
    <th
      className={cn(
        'h-12 px-4 text-left align-middle font-semibold text-white bg-slate-800/50',
        '[&:has([role=checkbox])]:pr-0',
        className
      )}
      {...props}
    />
  )
}

export interface TableCellProps extends TdHTMLAttributes<HTMLTableCellElement> {}

export function TableCell({ className, ...props }: TableCellProps) {
  return (
    <td
      className={cn(
        'px-4 py-3 align-middle text-gray-300',
        '[&:has([role=checkbox])]:pr-0',
        className
      )}
      {...props}
    />
  )
}
