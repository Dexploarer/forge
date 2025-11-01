// =====================================================
// COST CALCULATOR - AI Service Cost Estimation
// =====================================================

/**
 * OpenAI Pricing (as of 2025)
 * Prices are per 1M tokens
 */
const OPENAI_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4-turbo': { input: 10.00, output: 30.00 },
  'gpt-4': { input: 30.00, output: 60.00 },
  'gpt-4-32k': { input: 60.00, output: 120.00 },
  'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
  'gpt-3.5-turbo-16k': { input: 3.00, output: 4.00 },
  'text-embedding-3-small': { input: 0.02, output: 0.02 },
  'text-embedding-3-large': { input: 0.13, output: 0.13 },
  'text-embedding-ada-002': { input: 0.10, output: 0.10 },
  'dall-e-3': { input: 0.04, output: 0.08 }, // Per image (1024x1024 / 1024x1792)
  'dall-e-2': { input: 0.02, output: 0.02 }, // Per image (1024x1024)
}

/**
 * Anthropic Pricing (as of 2025)
 * Prices are per 1M tokens
 */
const ANTHROPIC_PRICING: Record<string, { input: number; output: number }> = {
  'claude-3-opus': { input: 15.00, output: 75.00 },
  'claude-3-sonnet': { input: 3.00, output: 15.00 },
  'claude-3-haiku': { input: 0.25, output: 1.25 },
  'claude-2.1': { input: 8.00, output: 24.00 },
  'claude-2.0': { input: 8.00, output: 24.00 },
}

/**
 * Meshy AI Pricing (as of 2025)
 * Flat rate per generation
 */
const MESHY_PRICING: Record<string, number> = {
  'text-to-3d': 0.10, // $0.10 per generation
  'image-to-3d': 0.15, // $0.15 per generation
  'text-to-texture': 0.05, // $0.05 per generation
  'refine-model': 0.20, // $0.20 per refinement
}

/**
 * ElevenLabs Pricing (as of 2025)
 * Price per 1000 characters
 */
const ELEVENLABS_PRICING: Record<string, number> = {
  'standard': 0.30, // $0.30 per 1000 characters
  'premium': 0.60, // $0.60 per 1000 characters
  'turbo': 0.15, // $0.15 per 1000 characters
}

/**
 * Calculate OpenAI API cost
 * @param tokens - Number of tokens used
 * @param model - Model identifier
 * @param tokenType - 'input' or 'output' (defaults to combined)
 * @returns Cost in USD cents
 */
export function calculateOpenAICost(
  tokens: number,
  model: string,
  tokenType: 'input' | 'output' | 'combined' = 'combined'
): number {
  const pricing = OPENAI_PRICING[model]

  if (!pricing) {
    // Unknown model - use gpt-3.5-turbo as fallback
    const fallbackPricing = OPENAI_PRICING['gpt-3.5-turbo']!
    const costPerToken = tokenType === 'output'
      ? fallbackPricing.output / 1000000
      : fallbackPricing.input / 1000000
    return Math.ceil(tokens * costPerToken * 100) // Return cents
  }

  let costUSD = 0
  if (tokenType === 'combined') {
    // Assume 50/50 split for combined
    costUSD = (tokens / 2) * (pricing.input / 1000000) + (tokens / 2) * (pricing.output / 1000000)
  } else {
    const pricePerMillion = tokenType === 'output' ? pricing.output : pricing.input
    costUSD = tokens * (pricePerMillion / 1000000)
  }

  return Math.ceil(costUSD * 100) // Return cents
}

/**
 * Calculate Anthropic API cost
 * @param tokens - Number of tokens used
 * @param model - Model identifier
 * @param tokenType - 'input' or 'output'
 * @returns Cost in USD cents
 */
export function calculateAnthropicCost(
  tokens: number,
  model: string,
  tokenType: 'input' | 'output' | 'combined' = 'combined'
): number {
  const pricing = ANTHROPIC_PRICING[model]

  if (!pricing) {
    // Unknown model - use claude-3-haiku as fallback
    const fallbackPricing = ANTHROPIC_PRICING['claude-3-haiku']!
    const costPerToken = tokenType === 'output'
      ? fallbackPricing.output / 1000000
      : fallbackPricing.input / 1000000
    return Math.ceil(tokens * costPerToken * 100) // Return cents
  }

  let costUSD = 0
  if (tokenType === 'combined') {
    // Assume 50/50 split for combined
    costUSD = (tokens / 2) * (pricing.input / 1000000) + (tokens / 2) * (pricing.output / 1000000)
  } else {
    const pricePerMillion = tokenType === 'output' ? pricing.output : pricing.input
    costUSD = tokens * (pricePerMillion / 1000000)
  }

  return Math.ceil(costUSD * 100) // Return cents
}

/**
 * Calculate Meshy AI cost
 * @param generationType - Type of generation
 * @returns Cost in USD cents
 */
export function calculateMeshyCost(generationType: string): number {
  const pricing = MESHY_PRICING[generationType]

  if (!pricing) {
    // Unknown type - use text-to-3d as fallback
    return Math.ceil(MESHY_PRICING['text-to-3d']! * 100) // Return cents
  }

  return Math.ceil(pricing * 100) // Return cents
}

/**
 * Calculate ElevenLabs cost
 * @param characters - Number of characters in text
 * @param voiceType - Voice quality tier
 * @returns Cost in USD cents
 */
export function calculateElevenLabsCost(
  characters: number,
  voiceType: string = 'standard'
): number {
  const pricing = ELEVENLABS_PRICING[voiceType] || ELEVENLABS_PRICING['standard']!
  const costUSD = (characters / 1000) * pricing
  return Math.ceil(costUSD * 100) // Return cents
}

/**
 * Format cost in cents to USD string
 * @param cents - Cost in cents
 * @returns Formatted USD string (e.g., "$1.23")
 */
export function formatCost(cents: number): string {
  const dollars = cents / 100
  return `$${dollars.toFixed(2)}`
}

/**
 * Get pricing information for a specific service and model
 * @param service - Service name
 * @param model - Model identifier
 * @returns Pricing information object
 */
export function getPricingInfo(
  service: string,
  model: string
): { input?: number; output?: number; flat?: number } | null {
  switch (service.toLowerCase()) {
    case 'openai':
      return OPENAI_PRICING[model] || null
    case 'anthropic':
      return ANTHROPIC_PRICING[model] || null
    case 'meshy':
      const meshyPrice = MESHY_PRICING[model]
      return meshyPrice ? { flat: meshyPrice } : null
    case 'elevenlabs':
      const elevenLabsPrice = ELEVENLABS_PRICING[model]
      return elevenLabsPrice ? { flat: elevenLabsPrice } : null
    default:
      return null
  }
}
