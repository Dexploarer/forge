/**
 * AvatarUpload Component
 * Upload and preview avatar images with drag-and-drop support
 */

import { useState, useRef, type DragEvent, type ChangeEvent } from 'react'
import { Upload, X, Image as ImageIcon } from 'lucide-react'
import { cn } from '../../utils/cn'
import { Input } from './Input'

export interface AvatarUploadProps {
  value?: string | null // Current avatar URL
  onChange: (file: File | null) => void
  onUrlChange?: (url: string) => void
  size?: 'sm' | 'md' | 'lg' | 'xl' // 80px, 120px, 160px, 200px
  shape?: 'circle' | 'square' | 'rounded' // circle, square, rounded-lg
  disabled?: boolean
  className?: string
}

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export function AvatarUpload({
  value,
  onChange,
  onUrlChange,
  size = 'md',
  shape = 'circle',
  disabled = false,
  className,
}: AvatarUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Size variants
  const sizes = {
    sm: 'w-20 h-20',
    md: 'w-[120px] h-[120px]',
    lg: 'w-40 h-40',
    xl: 'w-[200px] h-[200px]',
  }

  // Shape variants
  const shapes = {
    circle: 'rounded-full',
    square: 'rounded-none',
    rounded: 'rounded-lg',
  }

  // Validate file
  const validateFile = (file: File): string | null => {
    if (!file.type.startsWith('image/')) {
      return 'Please select an image file'
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'File size must be less than 5MB'
    }
    return null
  }

  // Handle file selection
  const handleFileSelect = async (file: File) => {
    setError(null)
    setIsLoading(true)

    const validationError = validateFile(file)
    if (validationError) {
      setError(validationError)
      setIsLoading(false)
      return
    }

    try {
      onChange(file)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process file')
    } finally {
      setIsLoading(false)
    }
  }

  // Handle file input change
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  // Handle drag events
  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (disabled) return

    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  // Handle click to select file
  const handleClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  // Handle remove
  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    setError(null)
    onChange(null)
    setUrlInput('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Handle URL input change
  const handleUrlInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value
    setUrlInput(url)
    if (onUrlChange && url.trim()) {
      onUrlChange(url.trim())
    }
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Avatar Preview/Drop Zone */}
      <div
        className={cn(
          'relative group cursor-pointer transition-all duration-200',
          sizes[size],
          shapes[shape],
          'border-2 overflow-hidden',
          value
            ? 'border-slate-700 hover:border-blue-500'
            : 'border-dashed border-slate-700 hover:border-blue-500',
          isDragging && 'bg-blue-500/10 border-blue-400',
          disabled && 'opacity-50 cursor-not-allowed',
          error && 'border-red-500'
        )}
        onClick={handleClick}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={value ? 'Change avatar' : 'Upload avatar'}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleClick()
          }
        }}
      >
        {/* Current Avatar or Placeholder */}
        {value ? (
          <>
            <img
              src={value}
              alt="Avatar preview"
              className="w-full h-full object-cover"
            />
            {/* Hover Overlay */}
            {!disabled && (
              <div
                className={cn(
                  'absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100',
                  'transition-opacity duration-200 flex items-center justify-center'
                )}
              >
                <Upload className="w-6 h-6 text-white" />
              </div>
            )}
            {/* Remove Button */}
            {!disabled && (
              <button
                type="button"
                onClick={handleRemove}
                className={cn(
                  'absolute top-2 right-2 p-1 bg-red-600 hover:bg-red-700',
                  'rounded-full opacity-0 group-hover:opacity-100',
                  'transition-opacity duration-200 focus:opacity-100 focus:outline-none',
                  'focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-slate-900'
                )}
                aria-label="Remove avatar"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            )}
          </>
        ) : (
          <div className="w-full h-full bg-slate-800 flex items-center justify-center">
            {isLoading ? (
              <svg
                className="animate-spin h-8 w-8 text-blue-500"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : (
              <div className="flex flex-col items-center gap-2">
                {isDragging ? (
                  <Upload className="w-8 h-8 text-blue-400" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-gray-500" />
                )}
                <span className="text-xs text-gray-500 text-center px-2">
                  {isDragging ? 'Drop here' : 'Upload'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled}
          aria-label="Upload avatar file"
        />
      </div>

      {/* URL Input (Optional) */}
      {onUrlChange && (
        <Input
          type="url"
          value={urlInput}
          onChange={handleUrlInputChange}
          placeholder="Or paste image URL..."
          disabled={disabled}
          className="text-sm"
          aria-label="Avatar image URL"
        />
      )}

      {/* Error Message */}
      {error && (
        <p className="text-sm text-red-500" role="alert">
          {error}
        </p>
      )}

      {/* Helper Text */}
      {!error && !value && (
        <p className="text-xs text-gray-500">
          Click to upload or drag and drop. Max 5MB.
        </p>
      )}
    </div>
  )
}
