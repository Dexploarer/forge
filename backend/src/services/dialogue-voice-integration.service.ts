/**
 * Dialogue-Voice Integration Service
 * Orchestrates dialogue tree generation with voice generation for each node
 */

import { ElevenLabsService, type VoiceSettings } from './elevenlabs.service'

// =====================================================
// TYPES
// =====================================================

export interface DialogueNode {
  id: string
  text: string
  speaker?: 'npc' | 'player'
  speakerName?: string
  responses?: Array<{
    text: string
    nextNodeId?: string
  }>
  audioUrl?: string
  audioData?: string
}

export interface DialogueTree {
  nodes: DialogueNode[]
  model?: string
  rawResponse?: string
}

export interface DialogueWithVoiceOptions {
  dialogueTree: DialogueTree
  voiceId: string
  npcName: string | undefined
  voiceSettings?: VoiceSettings | undefined
  generateForPlayerResponses?: boolean | undefined
}

export interface DialogueWithVoiceResult {
  dialogueTree: DialogueTree
  voicesGenerated: number
  totalNodes: number
  errors: Array<{
    nodeId: string
    error: string
  }>
}

// =====================================================
// SERVICE CLASS
// =====================================================

export class DialogueVoiceIntegrationService {
  private voiceService: ElevenLabsService

  constructor(apiKey: string) {
    this.voiceService = new ElevenLabsService({ apiKey })
  }

  /**
   * Generate voice audio for all dialogue nodes in a tree
   * Only generates voice for NPC dialogue (speaker: 'npc'), not player responses
   */
  async generateVoicesForDialogue(
    options: DialogueWithVoiceOptions
  ): Promise<DialogueWithVoiceResult> {
    const {
      dialogueTree,
      voiceId,
      voiceSettings,
      generateForPlayerResponses = false,
    } = options

    const errors: Array<{ nodeId: string; error: string }> = []
    let voicesGenerated = 0

    // Identify which nodes need voice generation
    const nodesToVoice = dialogueTree.nodes.filter((node) => {
      // If speaker is explicitly set, only voice NPC dialogue
      if (node.speaker) {
        return (
          node.speaker === 'npc' || (generateForPlayerResponses && node.speaker === 'player')
        )
      }
      // If no speaker field, assume it's NPC dialogue
      return true
    })

    console.log(
      `[DialogueVoice] Generating voice for ${nodesToVoice.length}/${dialogueTree.nodes.length} nodes`
    )

    // Batch generate voices (sequential processing)
    try {
      for (const node of dialogueTree.nodes) {
        // Skip nodes that don't need voicing
        const needsVoice = nodesToVoice.some((n) => n.id === node.id)
        if (!needsVoice) {
          continue
        }

        try {
          // Generate voice for this node
          const options: { voiceId: string; voiceSettings?: VoiceSettings } = { voiceId }
          if (voiceSettings) {
            options.voiceSettings = voiceSettings
          }
          const audioBuffer = await this.voiceService.textToSpeechBuffer(node.text, options)

          // Convert buffer to base64 data URL
          const base64Audio = audioBuffer.toString('base64')
          node.audioData = base64Audio
          node.audioUrl = `data:audio/mpeg;base64,${base64Audio}`
          voicesGenerated++
        } catch (nodeError) {
          console.error(
            `[DialogueVoice] Failed to generate voice for node ${node.id}:`,
            nodeError
          )
          errors.push({
            nodeId: node.id,
            error: (nodeError as Error).message,
          })
        }
      }

      console.log(
        `[DialogueVoice] Successfully generated ${voicesGenerated}/${nodesToVoice.length} voices`
      )
    } catch (error) {
      console.error('[DialogueVoice] Batch generation failed:', error)
      throw new Error(`Failed to generate voices: ${(error as Error).message}`)
    }

    return {
      dialogueTree,
      voicesGenerated,
      totalNodes: dialogueTree.nodes.length,
      errors,
    }
  }

  /**
   * Enhance dialogue tree with speaker metadata
   * Adds speaker and speakerName fields to nodes that don't have them
   */
  enhanceDialogueTreeWithSpeakers(dialogueTree: DialogueTree, npcName: string): DialogueTree {
    const enhancedNodes = dialogueTree.nodes.map((node) => {
      // If speaker is already set, keep it
      if (node.speaker) {
        return {
          ...node,
          speakerName: node.speaker === 'npc' ? npcName : 'Player',
        }
      }

      // Default assumption: top-level nodes are NPC dialogue
      // Nodes in responses array are player choices
      return {
        ...node,
        speaker: 'npc' as const,
        speakerName: npcName,
      }
    })

    return {
      ...dialogueTree,
      nodes: enhancedNodes,
    }
  }

  /**
   * Full workflow: Enhance dialogue tree with speakers and generate voices
   */
  async processDialogueWithVoice(
    dialogueTree: DialogueTree,
    voiceId: string,
    npcName: string,
    voiceSettings?: VoiceSettings
  ): Promise<DialogueWithVoiceResult> {
    // Step 1: Enhance with speaker metadata
    const enhancedTree = this.enhanceDialogueTreeWithSpeakers(dialogueTree, npcName)

    // Step 2: Generate voices
    const result = await this.generateVoicesForDialogue({
      dialogueTree: enhancedTree,
      voiceId,
      npcName,
      voiceSettings,
    })

    return result
  }
}
