import { pgEnum } from 'drizzle-orm/pg-core'

// =====================================================
// POSTGRESQL ENUMS - Type-safe status fields
// =====================================================

/**
 * User role - defines access level
 */
export const userRole = pgEnum('user_role', ['admin', 'member', 'guest'])

/**
 * Asset status - lifecycle state
 */
export const assetStatus = pgEnum('asset_status', [
  'draft',       // Created but not finalized
  'processing',  // Being generated/uploaded
  'published',   // Available for use
  'failed',      // Generation/upload failed
])

/**
 * Asset visibility - access control
 */
export const visibilityType = pgEnum('visibility_type', [
  'private',  // Owner only
  'public',   // Everyone
])

/**
 * Asset type - category of asset
 */
export const assetType = pgEnum('asset_type', [
  'model',    // 3D models (GLB, GLTF)
  'texture',  // Textures (PNG, JPG)
  'audio',    // Audio files (MP3, WAV)
])
