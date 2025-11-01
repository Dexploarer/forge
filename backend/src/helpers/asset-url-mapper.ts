/**
 * Asset URL Mapper
 *
 * Maps asset:// URIs to file server HTTPS URLs using the github-assets-manifest.json
 * This helper bridges the gap between the game's asset:// protocol and the actual file server URLs.
 */

import { readFileSync } from 'fs'
import { join } from 'path'

// =============================================================================
// TYPES
// =============================================================================

interface UploadedAsset {
  originalPath: string
  relativePath: string
  filename: string
  fileServerUrl: string
  size: number
  mimeType: string
  category: string
}

interface AssetManifest {
  uploadedAt: string
  totalAssets: number
  byCategory: Record<string, number>
  assets: UploadedAsset[]
}

// =============================================================================
// SINGLETON LOADER
// =============================================================================

class AssetUrlMapper {
  private manifest: AssetManifest | null = null
  private pathMap: Map<string, string> = new Map()
  private filenameMap: Map<string, string[]> = new Map()
  private fileServerBaseUrl: string

  constructor() {
    this.fileServerBaseUrl = process.env.FILE_SERVER_PUBLIC_URL ||
                             'https://file-server-production-2299.up.railway.app'
    this.loadManifest()
  }

  /**
   * Load the github-assets-manifest.json file
   */
  private loadManifest(): void {
    try {
      const manifestPath = join(process.cwd(), 'github-assets-manifest.json')
      const content = readFileSync(manifestPath, 'utf-8')
      this.manifest = JSON.parse(content)

      // Build lookup maps
      this.buildLookupMaps()

      console.log('[AssetUrlMapper] Loaded manifest with', this.manifest!.totalAssets, 'assets')
    } catch (error: any) {
      console.warn('[AssetUrlMapper] Could not load github-assets-manifest.json:', error.message)
      console.warn('[AssetUrlMapper] Asset URL mapping will not be available')
    }
  }

  /**
   * Build fast lookup maps for path and filename resolution
   */
  private buildLookupMaps(): void {
    if (!this.manifest) return

    for (const asset of this.manifest.assets) {
      // Map relative path → file server URL
      this.pathMap.set(asset.relativePath, asset.fileServerUrl)

      // Map filename → array of file server URLs (multiple files can have same name)
      if (!this.filenameMap.has(asset.filename)) {
        this.filenameMap.set(asset.filename, [])
      }
      this.filenameMap.get(asset.filename)!.push(asset.fileServerUrl)
    }
  }

  /**
   * Convert asset:// URI to file server HTTPS URL
   *
   * @param assetUri - asset://models/sword-bronze/sword-bronze.glb
   * @returns https://file-server-production-2299.up.railway.app/files/uploads/...
   */
  resolveAssetUrl(assetUri: string): string | null {
    if (!assetUri.startsWith('asset://')) {
      return null // Not an asset:// URI
    }

    // Remove asset:// prefix
    const relativePath = assetUri.replace('asset://', '')

    // Try exact path match first
    const exactMatch = this.pathMap.get(relativePath)
    if (exactMatch) {
      return exactMatch
    }

    // Try filename match (less precise, may return wrong file if multiple files have same name)
    const filename = relativePath.split('/').pop()
    if (filename) {
      const filenameMatches = this.filenameMap.get(filename)
      if (filenameMatches && filenameMatches.length > 0) {
        if (filenameMatches.length > 1) {
          console.warn(`[AssetUrlMapper] Multiple files found for "${filename}", using first match`)
        }
        return filenameMatches[0] || null
      }
    }

    // No match found
    console.warn(`[AssetUrlMapper] No file server URL found for: ${assetUri}`)
    return null
  }

  /**
   * Transform an object's asset:// URIs to file server URLs
   *
   * @param obj - Object with modelPath, iconPath, etc. fields
   * @returns New object with modelUrl, imageUrl fields added
   */
  transformAssetUrls<T extends Record<string, any>>(obj: T): T & Record<string, any> {
    const result: Record<string, any> = { ...obj }

    // Known field mappings
    const fieldMappings = [
      { source: 'modelPath', target: 'modelUrl' },
      { source: 'iconPath', target: 'imageUrl' },
      { source: 'iconPath', target: 'thumbnailUrl' },
      { source: 'imagePath', target: 'imageUrl' },
      { source: 'audioPath', target: 'audioUrl' },
    ]

    for (const { source, target } of fieldMappings) {
      if (obj[source] && typeof obj[source] === 'string') {
        const assetUri = obj[source] as string
        const fileServerUrl = this.resolveAssetUrl(assetUri)

        if (fileServerUrl) {
          result[target] = fileServerUrl

          // Keep the original asset:// path for reference
          if (!result[`${source}_original`]) {
            result[`${source}_original`] = assetUri
          }
        }
      }
    }

    return result as T & Record<string, any>
  }

  /**
   * Transform an array of objects' asset:// URIs
   */
  transformAssetUrlsArray<T extends Record<string, any>>(array: T[]): (T & Record<string, any>)[] {
    return array.map(item => this.transformAssetUrls(item))
  }

  /**
   * Get statistics about the loaded manifest
   */
  getStats() {
    if (!this.manifest) {
      return { loaded: false, totalAssets: 0, categories: {} }
    }

    return {
      loaded: true,
      totalAssets: this.manifest.totalAssets,
      categories: this.manifest.byCategory,
      uploadedAt: this.manifest.uploadedAt,
    }
  }

  /**
   * Check if mapper is ready (manifest loaded)
   */
  isReady(): boolean {
    return this.manifest !== null
  }

  /**
   * Get file server base URL
   */
  getFileServerUrl(): string {
    return this.fileServerBaseUrl
  }

  /**
   * Find all assets matching a pattern
   *
   * @param pattern - Regex pattern or substring to match against relativePath
   * @returns Array of matching assets
   */
  findAssets(pattern: string | RegExp): UploadedAsset[] {
    if (!this.manifest) return []

    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern

    return this.manifest.assets.filter(asset =>
      regex.test(asset.relativePath)
    )
  }

  /**
   * Get all assets in a category
   */
  getAssetsByCategory(category: string): UploadedAsset[] {
    if (!this.manifest) return []

    return this.manifest.assets.filter(asset => asset.category === category)
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const assetUrlMapper = new AssetUrlMapper()

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Convert asset:// URI to file server URL (convenience function)
 */
export function resolveAssetUrl(assetUri: string): string | null {
  return assetUrlMapper.resolveAssetUrl(assetUri)
}

/**
 * Transform object with asset:// URIs (convenience function)
 */
export function transformAssetUrls<T extends Record<string, any>>(obj: T): T & Record<string, any> {
  return assetUrlMapper.transformAssetUrls(obj)
}

/**
 * Transform array of objects with asset:// URIs (convenience function)
 */
export function transformAssetUrlsArray<T extends Record<string, any>>(array: T[]): (T & Record<string, any>)[] {
  return assetUrlMapper.transformAssetUrlsArray(array)
}
