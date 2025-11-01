/**
 * imgproxy Service
 * Generates signed URLs for image optimization and transformation via imgproxy
 *
 * Features:
 * - HMAC-SHA256 URL signing for security
 * - Dynamic image transformations (resize, crop, format, quality)
 * - Preset transformations (thumbnail, responsive, optimized)
 * - MinIO source URL support
 */

import { createHmac } from 'crypto'
import { env } from '@/config/env'

export interface ImgproxyOptions {
  width?: number
  height?: number
  resize?: 'fit' | 'fill' | 'auto' | 'force' // Resize type
  gravity?: 'no' | 'ce' | 'no' | 'so' | 'ea' | 'we' | 'noea' | 'nowe' | 'soea' | 'sowe' | 'sm' // Gravity/crop focus
  enlarge?: boolean // Allow enlarging images
  quality?: number // 1-100
  format?: 'jpg' | 'png' | 'webp' | 'avif' | 'gif' | 'auto' // Output format
  blur?: number // Blur radius
  sharpen?: number // Sharpen amount
  dpr?: number // Device pixel ratio (1, 2, 3)
}

export interface ImageVariants {
  original: string
  thumbnail: string  // 200x200
  small: string      // 400px wide
  medium: string     // 800px wide
  large: string      // 1200px wide
  webp?: string      // WebP format
  avif?: string      // AVIF format (best compression)
}

export class ImgproxyService {
  private enabled: boolean
  private baseUrl: string
  private key: Buffer | null = null
  private salt: Buffer | null = null

  constructor() {
    this.enabled = env.IMGPROXY_ENABLED &&
                   !!env.IMGPROXY_URL &&
                   !!env.IMGPROXY_KEY &&
                   !!env.IMGPROXY_SALT

    if (this.enabled) {
      // Parse hex key and salt to buffers
      this.key = Buffer.from(env.IMGPROXY_KEY!, 'hex')
      this.salt = Buffer.from(env.IMGPROXY_SALT!, 'hex')

      // Normalize base URL (remove trailing slash, add https if needed)
      let url = env.IMGPROXY_URL!
      if (!url.startsWith('http')) {
        url = `https://${url}`
      }
      this.baseUrl = url.replace(/\/$/, '')

      console.log(`✅ imgproxy service initialized (${this.baseUrl})`)
    } else {
      this.baseUrl = ''
      console.warn('⚠️  imgproxy service disabled - missing configuration')
    }
  }

  /**
   * Check if imgproxy is available
   */
  isAvailable(): boolean {
    return this.enabled
  }

  /**
   * Generate HMAC signature for a path
   */
  private sign(path: string): string {
    if (!this.key || !this.salt) {
      throw new Error('imgproxy key/salt not configured')
    }

    // Create HMAC: HMAC(salt + path)
    const hmac = createHmac('sha256', this.key)
    hmac.update(this.salt)
    hmac.update(path)

    // URL-safe base64 encoding (remove padding)
    return hmac.digest('base64url')
  }

  /**
   * Build processing options string
   */
  private buildProcessingOptions(options: ImgproxyOptions): string {
    const parts: string[] = []

    // Resize type and dimensions
    const resize = options.resize || 'fit'
    const width = options.width || 0
    const height = options.height || 0
    const enlarge = options.enlarge ? 1 : 0
    parts.push(`rs:${resize}:${width}:${height}:${enlarge}`)

    // Gravity (crop focus point)
    if (options.gravity) {
      parts.push(`g:${options.gravity}`)
    }

    // Quality
    if (options.quality !== undefined) {
      parts.push(`q:${Math.max(1, Math.min(100, options.quality))}`)
    }

    // Format
    if (options.format && options.format !== 'auto') {
      parts.push(`f:${options.format}`)
    }

    // Blur
    if (options.blur) {
      parts.push(`bl:${options.blur}`)
    }

    // Sharpen
    if (options.sharpen) {
      parts.push(`sh:${options.sharpen}`)
    }

    // Device pixel ratio
    if (options.dpr) {
      parts.push(`dpr:${options.dpr}`)
    }

    return parts.join('/')
  }

  /**
   * Generate signed imgproxy URL
   *
   * @param sourceUrl - Original image URL (can be MinIO URL)
   * @param options - Transformation options
   * @returns Signed imgproxy URL
   */
  generateUrl(sourceUrl: string, options: ImgproxyOptions = {}): string {
    if (!this.enabled) {
      // Return original URL if imgproxy not configured
      return sourceUrl
    }

    try {
      // Build processing options
      const processingOptions = this.buildProcessingOptions(options)

      // Encode source URL (plain mode)
      const encodedSource = Buffer.from(sourceUrl).toString('base64url')

      // Get file extension from source URL
      const ext = sourceUrl.split('.').pop()?.split('?')[0] || 'jpg'

      // Build path: /processing_options/encoded_source.ext
      const path = `/${processingOptions}/${encodedSource}.${ext}`

      // Sign the path
      const signature = this.sign(path)

      // Final URL: base_url/signature/path
      return `${this.baseUrl}/${signature}${path}`
    } catch (error) {
      console.error('[imgproxy] Failed to generate URL:', error)
      // Fallback to original URL on error
      return sourceUrl
    }
  }

  /**
   * Generate thumbnail URL (200x200, smart crop)
   */
  thumbnail(sourceUrl: string, size = 200): string {
    return this.generateUrl(sourceUrl, {
      width: size,
      height: size,
      resize: 'fill',
      gravity: 'sm', // Smart crop
      quality: 80,
      format: 'webp',
    })
  }

  /**
   * Generate optimized URL (auto format, good compression)
   */
  optimized(sourceUrl: string, quality = 85): string {
    return this.generateUrl(sourceUrl, {
      quality,
      format: 'auto', // imgproxy will choose best format (WebP/AVIF based on browser)
    })
  }

  /**
   * Generate responsive image URLs for different screen sizes
   */
  responsive(sourceUrl: string, sizes = [400, 800, 1200]): string[] {
    return sizes.map(width =>
      this.generateUrl(sourceUrl, {
        width,
        resize: 'auto',
        quality: 85,
        format: 'webp',
      })
    )
  }

  /**
   * Generate all common variants for an image
   */
  getImageVariants(sourceUrl: string): ImageVariants {
    if (!this.enabled) {
      // Return only original if imgproxy not available
      return {
        original: sourceUrl,
        thumbnail: sourceUrl,
        small: sourceUrl,
        medium: sourceUrl,
        large: sourceUrl,
      }
    }

    return {
      original: sourceUrl,
      thumbnail: this.thumbnail(sourceUrl, 200),
      small: this.generateUrl(sourceUrl, { width: 400, resize: 'auto', quality: 85, format: 'webp' }),
      medium: this.generateUrl(sourceUrl, { width: 800, resize: 'auto', quality: 85, format: 'webp' }),
      large: this.generateUrl(sourceUrl, { width: 1200, resize: 'auto', quality: 85, format: 'webp' }),
      webp: this.generateUrl(sourceUrl, { quality: 85, format: 'webp' }),
      avif: this.generateUrl(sourceUrl, { quality: 85, format: 'avif' }),
    }
  }

  /**
   * Check if a file is an image based on mimetype
   */
  isImage(mimetype: string): boolean {
    return mimetype.startsWith('image/')
  }

  /**
   * Get optimal quality based on image type
   */
  getOptimalQuality(mimetype: string): number {
    if (mimetype.includes('png')) return 95 // PNG needs higher quality
    if (mimetype.includes('jpeg') || mimetype.includes('jpg')) return 85
    if (mimetype.includes('webp')) return 80
    if (mimetype.includes('avif')) return 75 // AVIF has better compression
    return 85 // Default
  }
}

export const imgproxyService = new ImgproxyService()
