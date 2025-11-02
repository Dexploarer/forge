import React from 'react';
import { cn } from '../../utils/cn';

type TooltipPosition = 'top' | 'right' | 'bottom' | 'left';

interface TooltipProps {
  content: string;
  position?: TooltipPosition;
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  position = 'top',
  children,
  className,
  delay = 200,
}) => {
  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 -mt-1 border-r border-b',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 -mb-1 border-l border-t',
    left: 'left-full top-1/2 -translate-y-1/2 -ml-1 border-t border-r',
    right: 'right-full top-1/2 -translate-y-1/2 -mr-1 border-b border-l',
  }

  return (
    <div className="relative inline-block group">
      {children}
      <div
        className={cn(
          // Base styles
          'absolute z-50 px-3 py-2 text-sm font-medium text-slate-200',
          'bg-slate-800 border border-slate-700 rounded-lg shadow-lg',
          'pointer-events-none opacity-0 transition-opacity duration-200',
          'whitespace-nowrap',
          // Show on hover with delay
          delay === 0 ? 'group-hover:opacity-100' : 'group-hover:opacity-100 group-hover:delay-200',
          // Position-specific styles
          positionClasses[position],
          className
        )}
        role="tooltip"
        aria-hidden="true"
      >
        {content}
        {/* Arrow */}
        <div
          className={cn(
            'absolute w-2 h-2 bg-slate-800 border-slate-700 rotate-45',
            arrowClasses[position]
          )}
        />
      </div>
    </div>
  );
};
