/**
 * Image URL Helper Utilities
 * Convenience functions for working with image URLs and imgproxy transformations
 */

import { imgproxyService, type ImageVariants, type ImgproxyOptions } from '@/services/imgproxy.service'

/**
 * Check if a mimetype represents an image
 */
export function isImageMimetype(mimetype: string): boolean {
  return mimetype.startsWith('image/') && !mimetype.includes('svg')
}

/**
 * Get file extension from mimetype
 */
export function getExtensionFromMimetype(mimetype: string): string {
  const mimeMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/avif': 'avif',
  }
  return mimeMap[mimetype.toLowerCase()] || 'jpg'
}

/**
 * Generate all image variants for a source URL
 */
export function getImageVariants(sourceUrl: string | null | undefined): ImageVariants | null {
  if (!sourceUrl) return null

  return imgproxyService.getImageVariants(sourceUrl)
}

/**
 * Generate thumbnail URL
 */
export function getThumbnailUrl(sourceUrl: string | null | undefined, size = 200): string | null {
  if (!sourceUrl) return null

  if (!imgproxyService.isAvailable()) {
    return sourceUrl
  }

  return imgproxyService.thumbnail(sourceUrl, size)
}

/**
 * Generate optimized URL
 */
export function getOptimizedUrl(
  sourceUrl: string | null | undefined,
  mimetype?: string
): string | null {
  if (!sourceUrl) return null

  if (!imgproxyService.isAvailable()) {
    return sourceUrl
  }

  const quality = mimetype
    ? imgproxyService.getOptimalQuality(mimetype)
    : 85

  return imgproxyService.optimized(sourceUrl, quality)
}

/**
 * Generate responsive image URLs for srcset
 */
export function getResponsiveUrls(
  sourceUrl: string | null | undefined,
  sizes = [400, 800, 1200]
): string[] | null {
  if (!sourceUrl) return null

  if (!imgproxyService.isAvailable()) {
    return [sourceUrl]
  }

  return imgproxyService.responsive(sourceUrl, sizes)
}

/**
 * Generate custom transformed URL
 */
export function getTransformedUrl(
  sourceUrl: string | null | undefined,
  options: ImgproxyOptions
): string | null {
  if (!sourceUrl) return null

  if (!imgproxyService.isAvailable()) {
    return sourceUrl
  }

  return imgproxyService.generateUrl(sourceUrl, options)
}

/**
 * Build complete image response object with all variants
 */
export interface ImageResponse {
  url: string // Original URL
  thumbnailUrl: string
  optimizedUrl: string
  variants: ImageVariants
  responsive: {
    small: string    // 400px
    medium: string   // 800px
    large: string    // 1200px
  }
}

export function buildImageResponse(
  sourceUrl: string,
  mimetype?: string
): ImageResponse {
  const variants = imgproxyService.getImageVariants(sourceUrl)
  const quality = mimetype ? imgproxyService.getOptimalQuality(mimetype) : 85

  return {
    url: sourceUrl,
    thumbnailUrl: imgproxyService.thumbnail(sourceUrl),
    optimizedUrl: imgproxyService.optimized(sourceUrl, quality),
    variants,
    responsive: {
      small: variants.small,
      medium: variants.medium,
      large: variants.large,
    },
  }
}
