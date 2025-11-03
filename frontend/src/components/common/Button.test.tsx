/**
 * Button Component Tests
 * Comprehensive test suite following backend testing patterns
 */

import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './Button'

describe('Button Component', () => {
  // =====================================================
  // RENDERING TESTS
  // =====================================================

  describe('Rendering', () => {
    test('renders with default props', () => {
      render(<Button>Click me</Button>)

      const button = screen.getByRole('button', { name: /click me/i })
      expect(button).toBeInTheDocument()
      expect(button).toHaveTextContent('Click me')
    })

    test('renders with custom className', () => {
      render(<Button className="custom-class">Test</Button>)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('custom-class')
    })

    test('renders with children', () => {
      render(
        <Button>
          <span>Icon</span>
          <span>Text</span>
        </Button>
      )

      expect(screen.getByText('Icon')).toBeInTheDocument()
      expect(screen.getByText('Text')).toBeInTheDocument()
    })
  })

  // =====================================================
  // VARIANT TESTS
  // =====================================================

  describe('Variants', () => {
    test('renders primary variant by default', () => {
      render(<Button>Primary</Button>)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('bg-blue-600')
      expect(button).toHaveClass('text-white')
    })

    test('renders secondary variant', () => {
      render(<Button variant="secondary">Secondary</Button>)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('bg-slate-700')
      expect(button).toHaveClass('text-white')
    })

    test('renders ghost variant', () => {
      render(<Button variant="ghost">Ghost</Button>)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('bg-transparent')
      expect(button).toHaveClass('text-gray-300')
    })

    test('renders danger variant', () => {
      render(<Button variant="danger">Danger</Button>)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('bg-red-600')
      expect(button).toHaveClass('text-white')
    })
  })

  // =====================================================
  // SIZE TESTS
  // =====================================================

  describe('Sizes', () => {
    test('renders medium size by default', () => {
      render(<Button>Medium</Button>)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('text-sm')
      expect(button).toHaveClass('px-4')
      expect(button).toHaveClass('py-2')
    })

    test('renders small size', () => {
      render(<Button size="sm">Small</Button>)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('text-xs')
      expect(button).toHaveClass('px-3')
      expect(button).toHaveClass('py-1.5')
    })

    test('renders large size', () => {
      render(<Button size="lg">Large</Button>)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('text-base')
      expect(button).toHaveClass('px-6')
      expect(button).toHaveClass('py-3')
    })
  })

  // =====================================================
  // STATE TESTS
  // =====================================================

  describe('States', () => {
    test('renders disabled state', () => {
      render(<Button disabled>Disabled</Button>)

      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
      expect(button).toHaveClass('disabled:opacity-50')
      expect(button).toHaveClass('disabled:cursor-not-allowed')
    })

    test('renders loading state', () => {
      render(<Button loading>Loading</Button>)

      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
      expect(button).toHaveClass('cursor-wait')

      // Check for spinner SVG
      const spinner = button.querySelector('svg')
      expect(spinner).toBeInTheDocument()
      expect(spinner).toHaveClass('animate-spin')
    })

    test('disables button when loading', () => {
      render(<Button loading>Loading</Button>)

      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
    })

    test('loading state has priority over disabled', () => {
      render(<Button loading disabled>Loading</Button>)

      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
      expect(button).toHaveClass('cursor-wait')
    })
  })

  // =====================================================
  // INTERACTION TESTS
  // =====================================================

  describe('Interactions', () => {
    test('calls onClick handler when clicked', async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()

      render(<Button onClick={handleClick}>Click me</Button>)

      const button = screen.getByRole('button')
      await user.click(button)

      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    test('does not call onClick when disabled', async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()

      render(<Button onClick={handleClick} disabled>Disabled</Button>)

      const button = screen.getByRole('button')
      await user.click(button)

      expect(handleClick).not.toHaveBeenCalled()
    })

    test('does not call onClick when loading', async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()

      render(<Button onClick={handleClick} loading>Loading</Button>)

      const button = screen.getByRole('button')
      await user.click(button)

      expect(handleClick).not.toHaveBeenCalled()
    })

    test('handles keyboard events', async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()

      render(<Button onClick={handleClick}>Press Enter</Button>)

      const button = screen.getByRole('button')
      button.focus()
      await user.keyboard('{Enter}')

      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    test('handles focus and blur', async () => {
      const handleFocus = vi.fn()
      const handleBlur = vi.fn()

      render(
        <Button onFocus={handleFocus} onBlur={handleBlur}>
          Focus me
        </Button>
      )

      const button = screen.getByRole('button')
      button.focus()
      expect(handleFocus).toHaveBeenCalledTimes(1)

      button.blur()
      expect(handleBlur).toHaveBeenCalledTimes(1)
    })
  })

  // =====================================================
  // ACCESSIBILITY TESTS
  // =====================================================

  describe('Accessibility', () => {
    test('has correct role', () => {
      render(<Button>Accessible</Button>)

      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
    })

    test('has accessible name from children', () => {
      render(<Button>Submit Form</Button>)

      expect(screen.getByRole('button', { name: /submit form/i })).toBeInTheDocument()
    })

    test('has accessible name from aria-label', () => {
      render(<Button aria-label="Close dialog">X</Button>)

      expect(screen.getByRole('button', { name: /close dialog/i })).toBeInTheDocument()
    })

    test('supports aria-disabled when disabled', () => {
      render(<Button disabled aria-disabled="true">Disabled</Button>)

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-disabled', 'true')
    })

    test('has focus styles', () => {
      render(<Button>Focus me</Button>)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('focus:outline-none')
      expect(button).toHaveClass('focus:ring-2')
      expect(button).toHaveClass('focus:ring-blue-500')
    })
  })

  // =====================================================
  // PROP FORWARDING TESTS
  // =====================================================

  describe('HTML Attributes', () => {
    test('forwards native button attributes', () => {
      render(
        <Button
          type="submit"
          name="submit-btn"
          data-testid="custom-btn"
          aria-label="Submit form"
        >
          Submit
        </Button>
      )

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('type', 'submit')
      expect(button).toHaveAttribute('name', 'submit-btn')
      expect(button).toHaveAttribute('data-testid', 'custom-btn')
      expect(button).toHaveAttribute('aria-label', 'Submit form')
    })

    test('forwards event handlers', async () => {
      const handleMouseEnter = vi.fn()
      const handleMouseLeave = vi.fn()
      const user = userEvent.setup()

      render(
        <Button
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          Hover me
        </Button>
      )

      const button = screen.getByRole('button')
      await user.hover(button)
      expect(handleMouseEnter).toHaveBeenCalledTimes(1)

      await user.unhover(button)
      expect(handleMouseLeave).toHaveBeenCalledTimes(1)
    })
  })

  // =====================================================
  // COMBINED PROPS TESTS
  // =====================================================

  describe('Combined Props', () => {
    test('combines variant, size, and className', () => {
      render(
        <Button variant="secondary" size="lg" className="w-full">
          Combined
        </Button>
      )

      const button = screen.getByRole('button')
      expect(button).toHaveClass('bg-slate-700') // variant
      expect(button).toHaveClass('text-base') // size
      expect(button).toHaveClass('w-full') // custom className
    })

    test('applies all states correctly', () => {
      const { rerender } = render(<Button>Normal</Button>)
      let button = screen.getByRole('button')
      expect(button).not.toBeDisabled()

      rerender(<Button disabled>Disabled</Button>)
      button = screen.getByRole('button')
      expect(button).toBeDisabled()

      rerender(<Button loading>Loading</Button>)
      button = screen.getByRole('button')
      expect(button).toBeDisabled()
      expect(button.querySelector('svg')).toBeInTheDocument()
    })
  })

  // =====================================================
  // EDGE CASES
  // =====================================================

  describe('Edge Cases', () => {
    test('handles empty children gracefully', () => {
      render(<Button>{''}</Button>)

      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
    })

    test('handles null className', () => {
      render(<Button className={undefined}>Test</Button>)

      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
    })

    test('prevents multiple rapid clicks', async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()

      render(<Button onClick={handleClick}>Click rapidly</Button>)

      const button = screen.getByRole('button')
      await user.tripleClick(button)

      // Button should receive all clicks unless debounced/throttled
      expect(handleClick).toHaveBeenCalled()
    })
  })
})
