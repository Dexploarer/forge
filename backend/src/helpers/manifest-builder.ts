import { createHash } from 'crypto'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { eq } from 'drizzle-orm'
import * as schema from '../database/schema'

// =====================================================
// MANIFEST BUILDER - Game Manifest Generation
// =====================================================

export interface GameManifest {
  version: string
  buildNumber: number
  generatedAt: string
  project: {
    id: string
    name: string
  }
  assets: Array<{
    id: string
    name: string
    type: string
    fileUrl: string | null
    metadata: Record<string, unknown>
  }>
  quests: Array<{
    id: string
    title: string
    description: string | null
    metadata: Record<string, unknown>
  }>
  npcs: Array<{
    id: string
    name: string
    description: string | null
    metadata: Record<string, unknown>
  }>
  lore: Array<{
    id: string
    title: string
    content: string | null
    category: string | null
  }>
  music: Array<{
    id: string
    name: string
    fileUrl: string | null
    metadata: Record<string, unknown>
  }>
  soundEffects: Array<{
    id: string
    name: string
    fileUrl: string | null
    metadata: Record<string, unknown>
  }>
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export interface ManifestDiff {
  added: {
    assets: number
    quests: number
    npcs: number
    lore: number
    music: number
    soundEffects: number
  }
  removed: {
    assets: number
    quests: number
    npcs: number
    lore: number
    music: number
    soundEffects: number
  }
  modified: {
    assets: number
    quests: number
    npcs: number
    lore: number
    music: number
    soundEffects: number
  }
}

/**
 * Build a complete game manifest from a project
 */
export async function buildManifest(
  db: PostgresJsDatabase<typeof schema>,
  projectId: string,
  version: string,
  buildNumber: number
): Promise<GameManifest> {
  // Get project
  const project = await db.query.projects.findFirst({
    where: eq(schema.projects.id, projectId),
  })

  if (!project) {
    throw new Error('Project not found')
  }

  // Get all project assets
  const projectAssets = await db.query.projectAssets.findMany({
    where: eq(schema.projectAssets.projectId, projectId),
    with: {
      asset: true,
    },
  })

  // Get all quests for the project
  const quests = await db.query.quests.findMany({
    where: eq(schema.quests.projectId, projectId),
  })

  // Get all NPCs for the project
  const npcs = await db.query.npcs.findMany({
    where: eq(schema.npcs.projectId, projectId),
  })

  // Get all lore for the project
  const lore = await db.query.loreEntries.findMany({
    where: eq(schema.loreEntries.projectId, projectId),
  })

  // Get all music for the project
  const music = await db.query.musicTracks.findMany({
    where: eq(schema.musicTracks.projectId, projectId),
  })

  // Get all sound effects for the project
  const soundEffects = await db.query.soundEffects.findMany({
    where: eq(schema.soundEffects.projectId, projectId),
  })

  return {
    version,
    buildNumber,
    generatedAt: new Date().toISOString(),
    project: {
      id: project.id,
      name: project.name,
    },
    assets: projectAssets.map(pa => ({
      id: pa.asset.id,
      name: pa.asset.name,
      type: pa.asset.type,
      fileUrl: pa.asset.fileUrl,
      metadata: pa.asset.metadata as Record<string, unknown>,
    })),
    quests: quests.map(q => ({
      id: q.id,
      title: q.name,
      description: q.description,
      metadata: q.metadata as Record<string, unknown>,
    })),
    npcs: npcs.map(n => ({
      id: n.id,
      name: n.name,
      description: n.description,
      metadata: n.metadata as Record<string, unknown>,
    })),
    lore: lore.map(l => ({
      id: l.id,
      title: l.title,
      content: l.content,
      category: l.category,
    })),
    music: music.map(m => ({
      id: m.id,
      name: m.name,
      fileUrl: m.audioUrl,
      metadata: m.metadata as Record<string, unknown>,
    })),
    soundEffects: soundEffects.map(s => ({
      id: s.id,
      name: s.name,
      fileUrl: s.audioUrl,
      metadata: s.metadata as Record<string, unknown>,
    })),
  }
}

/**
 * Validate a game manifest
 */
export function validateManifest(manifest: GameManifest): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Version validation
  const versionRegex = /^\d+\.\d+\.\d+$/
  if (!versionRegex.test(manifest.version)) {
    errors.push('Version must be in semantic versioning format (e.g., 1.0.0)')
  }

  // Content validation
  const totalAssets = manifest.assets.length +
    manifest.quests.length +
    manifest.npcs.length +
    manifest.lore.length +
    manifest.music.length +
    manifest.soundEffects.length

  if (totalAssets === 0) {
    errors.push('Manifest must contain at least one asset, quest, NPC, lore entry, music track, or sound effect')
  }

  // Check for missing file URLs
  const assetsWithoutFiles = manifest.assets.filter(a => !a.fileUrl)
  if (assetsWithoutFiles.length > 0) {
    warnings.push(`${assetsWithoutFiles.length} asset(s) are missing file URLs`)
  }

  const musicWithoutFiles = manifest.music.filter(m => !m.fileUrl)
  if (musicWithoutFiles.length > 0) {
    warnings.push(`${musicWithoutFiles.length} music track(s) are missing file URLs`)
  }

  const sfxWithoutFiles = manifest.soundEffects.filter(s => !s.fileUrl)
  if (sfxWithoutFiles.length > 0) {
    warnings.push(`${sfxWithoutFiles.length} sound effect(s) are missing file URLs`)
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Generate a SHA-256 hash of a manifest
 */
export function generateManifestHash(manifest: GameManifest): string {
  const manifestString = JSON.stringify(manifest, null, 0)
  return createHash('sha256').update(manifestString).digest('hex')
}

/**
 * Compare two manifests and generate a diff
 */
export function diffManifests(v1: GameManifest, v2: GameManifest): ManifestDiff {
  const diff: ManifestDiff = {
    added: {
      assets: 0,
      quests: 0,
      npcs: 0,
      lore: 0,
      music: 0,
      soundEffects: 0,
    },
    removed: {
      assets: 0,
      quests: 0,
      npcs: 0,
      lore: 0,
      music: 0,
      soundEffects: 0,
    },
    modified: {
      assets: 0,
      quests: 0,
      npcs: 0,
      lore: 0,
      music: 0,
      soundEffects: 0,
    },
  }

  // Helper function to compare arrays
  const compareArrays = <T extends { id: string }>(
    arr1: T[],
    arr2: T[],
    category: keyof ManifestDiff['added']
  ) => {
    const ids1 = new Set(arr1.map(item => item.id))
    const ids2 = new Set(arr2.map(item => item.id))

    // Added items
    diff.added[category] = arr2.filter(item => !ids1.has(item.id)).length

    // Removed items
    diff.removed[category] = arr1.filter(item => !ids2.has(item.id)).length

    // Modified items (items that exist in both but might have changes)
    const commonIds = arr1.filter(item => ids2.has(item.id)).map(item => item.id)
    const map1 = new Map(arr1.map(item => [item.id, JSON.stringify(item)]))
    const map2 = new Map(arr2.map(item => [item.id, JSON.stringify(item)]))

    diff.modified[category] = commonIds.filter(id => map1.get(id) !== map2.get(id)).length
  }

  compareArrays(v1.assets, v2.assets, 'assets')
  compareArrays(v1.quests, v2.quests, 'quests')
  compareArrays(v1.npcs, v2.npcs, 'npcs')
  compareArrays(v1.lore, v2.lore, 'lore')
  compareArrays(v1.music, v2.music, 'music')
  compareArrays(v1.soundEffects, v2.soundEffects, 'soundEffects')

  return diff
}
