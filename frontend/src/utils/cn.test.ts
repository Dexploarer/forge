/**
 * Class Name Utility Tests
 * Comprehensive test suite following backend testing patterns
 */

import { describe, test, expect } from 'vitest'
import { cn } from './cn'

describe('cn (className utility)', () => {
  // =====================================================
  // BASIC FUNCTIONALITY
  // =====================================================

  describe('Basic Functionality', () => {
    test('combines multiple class names', () => {
      const result = cn('foo', 'bar', 'baz')
      expect(result).toBe('foo bar baz')
    })

    test('returns single class name unchanged', () => {
      const result = cn('single-class')
      expect(result).toBe('single-class')
    })

    test('returns empty string for no arguments', () => {
      const result = cn()
      expect(result).toBe('')
    })

    test('handles empty strings', () => {
      const result = cn('', 'foo', '', 'bar', '')
      expect(result).toBe('foo bar')
    })
  })

  // =====================================================
  // FALSY VALUE HANDLING
  // =====================================================

  describe('Falsy Values', () => {
    test('filters out undefined values', () => {
      const result = cn('foo', undefined, 'bar')
      expect(result).toBe('foo bar')
    })

    test('filters out null values', () => {
      const result = cn('foo', null, 'bar')
      expect(result).toBe('foo bar')
    })

    test('filters out false values', () => {
      const result = cn('foo', false, 'bar')
      expect(result).toBe('foo bar')
    })

    test('handles all falsy values at once', () => {
      const result = cn('foo', undefined, null, false, 'bar', '', 'baz')
      expect(result).toBe('foo bar baz')
    })

    test('returns empty string for all falsy values', () => {
      const result = cn(undefined, null, false, '')
      expect(result).toBe('')
    })
  })

  // =====================================================
  // CONDITIONAL CLASSES
  // =====================================================

  describe('Conditional Classes', () => {
    test('applies class when condition is true', () => {
      const isActive = true
      const result = cn('base', isActive && 'active')
      expect(result).toBe('base active')
    })

    test('skips class when condition is false', () => {
      const isActive = false
      const result = cn('base', isActive && 'active')
      expect(result).toBe('base')
    })

    test('handles multiple conditional classes', () => {
      const isActive = true
      const isDisabled = false
      const isLoading = true

      const result = cn(
        'base',
        isActive && 'active',
        isDisabled && 'disabled',
        isLoading && 'loading'
      )

      expect(result).toBe('base active loading')
    })

    test('works with ternary operators', () => {
      const variant = 'primary'
      const result = cn(
        'btn',
        variant === 'primary' ? 'btn-primary' : 'btn-secondary'
      )
      expect(result).toBe('btn btn-primary')
    })
  })

  // =====================================================
  // TAILWIND USE CASES
  // =====================================================

  describe('Tailwind CSS Use Cases', () => {
    test('combines base and variant classes', () => {
      const result = cn(
        'px-4 py-2 rounded',
        'bg-blue-600 hover:bg-blue-700',
        'text-white'
      )
      expect(result).toBe('px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white')
    })

    test('handles responsive classes', () => {
      const result = cn(
        'w-full',
        'sm:w-1/2',
        'md:w-1/3',
        'lg:w-1/4'
      )
      expect(result).toBe('w-full sm:w-1/2 md:w-1/3 lg:w-1/4')
    })

    test('combines state modifiers', () => {
      const result = cn(
        'opacity-100',
        'hover:opacity-80',
        'focus:opacity-60',
        'disabled:opacity-50'
      )
      expect(result).toBe('opacity-100 hover:opacity-80 focus:opacity-60 disabled:opacity-50')
    })

    test('handles dark mode classes', () => {
      const result = cn(
        'bg-white text-black',
        'dark:bg-black dark:text-white'
      )
      expect(result).toBe('bg-white text-black dark:bg-black dark:text-white')
    })
  })

  // =====================================================
  // COMPONENT PATTERNS
  // =====================================================

  describe('Component Patterns', () => {
    test('base classes with variants map', () => {
      const variants = {
        primary: 'bg-blue-600 text-white',
        secondary: 'bg-gray-600 text-white',
        danger: 'bg-red-600 text-white',
      }

      const variant = 'primary'
      const result = cn('px-4 py-2 rounded', variants[variant])

      expect(result).toBe('px-4 py-2 rounded bg-blue-600 text-white')
    })

    test('base classes with sizes map', () => {
      const sizes = {
        sm: 'text-xs px-2 py-1',
        md: 'text-sm px-4 py-2',
        lg: 'text-base px-6 py-3',
      }

      const size = 'lg'
      const result = cn('rounded', sizes[size])

      expect(result).toBe('rounded text-base px-6 py-3')
    })

    test('combines props with defaults', () => {
      const defaultClasses = 'btn'
      const customClasses = 'custom-btn'

      const result = cn(defaultClasses, customClasses)
      expect(result).toBe('btn custom-btn')
    })

    test('handles component state classes', () => {
      const disabled = false
      const loading = true
      const error = false

      const result = cn(
        'btn',
        disabled && 'btn-disabled',
        loading && 'btn-loading',
        error && 'btn-error'
      )

      expect(result).toBe('btn btn-loading')
    })
  })

  // =====================================================
  // EDGE CASES
  // =====================================================

  describe('Edge Cases', () => {
    test('handles very long class strings', () => {
      const longClass = 'class-'.repeat(100).slice(0, -1)
      const result = cn(longClass, 'another-class')
      expect(result).toContain('class-')
      expect(result).toContain('another-class')
    })

    test('handles special characters in class names', () => {
      const result = cn('has-[data-state=open]:rotate-180', 'peer-disabled:opacity-50')
      expect(result).toBe('has-[data-state=open]:rotate-180 peer-disabled:opacity-50')
    })

    test('handles numbers in class names', () => {
      const result = cn('z-10', 'top-1', 'left-0')
      expect(result).toBe('z-10 top-1 left-0')
    })

    test('preserves class order', () => {
      const result = cn('first', 'second', 'third', 'fourth')
      expect(result).toBe('first second third fourth')
    })

    test('handles duplicate class names (does not deduplicate)', () => {
      const result = cn('foo', 'foo', 'bar')
      // Note: cn() does NOT deduplicate - this is expected behavior
      expect(result).toBe('foo foo bar')
    })

    test('handles only whitespace', () => {
      const result = cn('   ', 'foo', '  ')
      expect(result).toBe('    foo   ')
    })
  })

  // =====================================================
  // TYPE SAFETY
  // =====================================================

  describe('Type Safety', () => {
    test('accepts string literals', () => {
      const result = cn('literal-class')
      expect(result).toBe('literal-class')
    })

    test('accepts template literals', () => {
      const color = 'blue'
      const result = cn(`text-${color}-600`)
      expect(result).toBe('text-blue-600')
    })

    test('accepts variables', () => {
      const baseClass = 'base'
      const variantClass = 'variant'
      const result = cn(baseClass, variantClass)
      expect(result).toBe('base variant')
    })

    test('accepts function returns', () => {
      const getClass = () => 'dynamic-class'
      const result = cn('static', getClass())
      expect(result).toBe('static dynamic-class')
    })
  })

  // =====================================================
  // REAL-WORLD SCENARIOS
  // =====================================================

  describe('Real-World Scenarios', () => {
    test('button component with all props', () => {
      const variant = 'primary'
      const size = 'md'
      const disabled = false
      const loading = true
      const className = 'w-full'

      const variants = {
        primary: 'bg-blue-600 hover:bg-blue-700',
        secondary: 'bg-gray-600 hover:bg-gray-700',
      }

      const sizes = {
        sm: 'text-xs px-3 py-1.5',
        md: 'text-sm px-4 py-2',
      }

      const result = cn(
        'inline-flex items-center justify-center rounded-lg',
        variants[variant],
        sizes[size],
        disabled && 'opacity-50 cursor-not-allowed',
        loading && 'cursor-wait',
        className
      )

      expect(result).toContain('inline-flex')
      expect(result).toContain('bg-blue-600')
      expect(result).toContain('text-sm')
      expect(result).toContain('cursor-wait')
      expect(result).toContain('w-full')
      expect(result).not.toContain('opacity-50')
    })

    test('card component with conditional states', () => {
      const isHovered = true
      const isSelected = false
      const isDragging = true

      const result = cn(
        'p-4 rounded-lg border',
        'bg-white dark:bg-gray-800',
        isHovered && 'shadow-lg',
        isSelected && 'border-blue-500',
        isDragging && 'opacity-50 cursor-grabbing'
      )

      expect(result).toContain('shadow-lg')
      expect(result).toContain('opacity-50')
      expect(result).toContain('cursor-grabbing')
      expect(result).not.toContain('border-blue-500')
    })
  })
})
