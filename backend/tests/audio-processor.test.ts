import { test, expect, describe, beforeAll } from 'bun:test'
import { audioProcessorService } from '../src/services/audio-processor.service'

describe('Audio Processor Service', () => {
  let testAudioBuffer: Buffer
  let isFFmpegAvailable: boolean
  let isFFprobeAvailable: boolean

  beforeAll(async () => {
    // Create a simple test audio buffer (silence, MP3-like format)
    // For real tests, this should be a valid audio file buffer
    testAudioBuffer = Buffer.from('ID3\x04\x00\x00\x00\x00\x00\x00', 'utf-8')

    // Check ffmpeg/ffprobe availability
    const availability = await audioProcessorService.isAvailable()
    isFFmpegAvailable = availability.ffmpeg
    isFFprobeAvailable = availability.ffprobe

    if (!isFFmpegAvailable) {
      console.warn('FFmpeg not found. Some tests will verify graceful degradation.')
    }
    if (!isFFprobeAvailable) {
      console.warn('FFprobe not found. Some tests will verify graceful degradation.')
    }
  })

  // =====================================================
  // HELPER METHOD TESTS
  // =====================================================

  test('checkFfmpegAvailable returns boolean', async () => {
    const result = await audioProcessorService.checkFfmpegAvailable()
    expect(typeof result).toBe('boolean')
  })

  test('checkFfprobeAvailable returns boolean', async () => {
    const result = await audioProcessorService.checkFfprobeAvailable()
    expect(typeof result).toBe('boolean')
  })

  test('isAvailable returns status object', async () => {
    const result = await audioProcessorService.isAvailable()
    expect(result).toHaveProperty('ffmpeg')
    expect(result).toHaveProperty('ffprobe')
    expect(typeof result.ffmpeg).toBe('boolean')
    expect(typeof result.ffprobe).toBe('boolean')
  })

  test('validateAudioBuffer accepts valid buffer', () => {
    const validBuffer = Buffer.from('test audio data')
    expect(audioProcessorService.validateAudioBuffer(validBuffer)).toBe(true)
  })

  test('validateAudioBuffer rejects empty buffer', () => {
    const emptyBuffer = Buffer.from('')
    expect(audioProcessorService.validateAudioBuffer(emptyBuffer)).toBe(false)
  })

  test('validateAudioBuffer rejects null buffer', () => {
    expect(audioProcessorService.validateAudioBuffer(null as any)).toBe(false)
  })

  test('validateAudioBuffer rejects oversized buffer', () => {
    const maxSize = 1024 // 1KB max
    const largeBuffer = Buffer.alloc(2048) // 2KB buffer
    expect(audioProcessorService.validateAudioBuffer(largeBuffer, maxSize)).toBe(false)
  })

  test('isSupportedFormat returns true for mp3', () => {
    expect(audioProcessorService.isSupportedFormat('mp3')).toBe(true)
  })

  test('isSupportedFormat returns true for wav', () => {
    expect(audioProcessorService.isSupportedFormat('wav')).toBe(true)
  })

  test('isSupportedFormat returns false for unknown format', () => {
    expect(audioProcessorService.isSupportedFormat('xyz')).toBe(false)
  })

  test('isSupportedFormat is case-insensitive', () => {
    expect(audioProcessorService.isSupportedFormat('MP3')).toBe(true)
    expect(audioProcessorService.isSupportedFormat('WAV')).toBe(true)
  })

  test('getRecommendedFormat returns mp3 for music', () => {
    expect(audioProcessorService.getRecommendedFormat('music')).toBe('mp3')
  })

  test('getRecommendedFormat returns wav for sfx', () => {
    expect(audioProcessorService.getRecommendedFormat('sfx')).toBe('wav')
  })

  test('getRecommendedFormat returns mp3 for voice', () => {
    expect(audioProcessorService.getRecommendedFormat('voice')).toBe('mp3')
  })

  test('estimateDuration calculates duration from file size', () => {
    const fileSize = 16000 // bytes
    const bitrate = 128000 // bits per second
    const duration = audioProcessorService.estimateDuration(fileSize, bitrate)
    expect(duration).toBe(1) // 1 second
  })

  // =====================================================
  // NORMALIZE VOLUME TESTS
  // =====================================================

  test('normalizeVolume validates empty buffer', async () => {
    await expect(
      audioProcessorService.normalizeVolume(Buffer.from(''))
    ).rejects.toThrow('Invalid audio buffer')
  })

  test('normalizeVolume validates target level range', async () => {
    await expect(
      audioProcessorService.normalizeVolume(testAudioBuffer, 10)
    ).rejects.toThrow('Target level must be between -70 and 0 dB')
  })

  test('normalizeVolume returns buffer when ffmpeg unavailable', async () => {
    if (!isFFmpegAvailable) {
      const result = await audioProcessorService.normalizeVolume(testAudioBuffer, -16)
      expect(Buffer.isBuffer(result)).toBe(true)
      expect(result).toEqual(testAudioBuffer) // Should return original buffer
    } else {
      expect(true).toBe(true) // Skip if ffmpeg is available
    }
  })

  test('normalizeVolume accepts valid parameters', async () => {
    const result = await audioProcessorService.normalizeVolume(testAudioBuffer, -16)
    expect(Buffer.isBuffer(result)).toBe(true)
  }, 10000)

  // =====================================================
  // TRIM SILENCE TESTS
  // =====================================================

  test('trimSilence validates empty buffer', async () => {
    await expect(
      audioProcessorService.trimSilence(Buffer.from(''))
    ).rejects.toThrow('Invalid audio buffer')
  })

  test('trimSilence validates threshold range', async () => {
    await expect(
      audioProcessorService.trimSilence(testAudioBuffer, -70)
    ).rejects.toThrow('Threshold must be between -60 and 0 dB')
  })

  test('trimSilence returns buffer when ffmpeg unavailable', async () => {
    if (!isFFmpegAvailable) {
      const result = await audioProcessorService.trimSilence(testAudioBuffer, -40)
      expect(Buffer.isBuffer(result)).toBe(true)
      expect(result).toEqual(testAudioBuffer) // Should return original buffer
    } else {
      expect(true).toBe(true) // Skip if ffmpeg is available
    }
  })

  test('trimSilence accepts valid parameters', async () => {
    const result = await audioProcessorService.trimSilence(testAudioBuffer, -40)
    expect(Buffer.isBuffer(result)).toBe(true)
  }, 10000)

  // =====================================================
  // CONVERT FORMAT TESTS
  // =====================================================

  test('convertFormat validates empty buffer', async () => {
    await expect(
      audioProcessorService.convertFormat(Buffer.from(''), 'wav')
    ).rejects.toThrow('Invalid audio buffer')
  })

  test('convertFormat validates unsupported format', async () => {
    await expect(
      audioProcessorService.convertFormat(testAudioBuffer, 'xyz')
    ).rejects.toThrow('Unsupported target format')
  })

  test('convertFormat returns buffer when ffmpeg unavailable', async () => {
    if (!isFFmpegAvailable) {
      const result = await audioProcessorService.convertFormat(testAudioBuffer, 'wav')
      expect(Buffer.isBuffer(result)).toBe(true)
      expect(result).toEqual(testAudioBuffer) // Should return original buffer
    } else {
      expect(true).toBe(true) // Skip if ffmpeg is available
    }
  })

  test('convertFormat accepts valid parameters', async () => {
    const result = await audioProcessorService.convertFormat(testAudioBuffer, 'wav')
    expect(Buffer.isBuffer(result)).toBe(true)
  }, 10000)

  // =====================================================
  // EXTRACT METADATA TESTS
  // =====================================================

  test('extractMetadata validates empty buffer', async () => {
    await expect(
      audioProcessorService.extractMetadata(Buffer.from(''))
    ).rejects.toThrow('Invalid audio buffer')
  })

  test('extractMetadata returns metadata object when ffprobe unavailable', async () => {
    if (!isFFprobeAvailable) {
      const result = await audioProcessorService.extractMetadata(testAudioBuffer)
      expect(result).toHaveProperty('duration')
      expect(result).toHaveProperty('format')
      expect(result).toHaveProperty('sampleRate')
      expect(result).toHaveProperty('channels')
      expect(result).toHaveProperty('bitrate')
      expect(result).toHaveProperty('codec')
      expect(result.format).toBe('unknown') // Estimation fallback
    } else {
      expect(true).toBe(true) // Skip if ffprobe is available
    }
  })

  test('extractMetadata returns complete metadata object', async () => {
    const result = await audioProcessorService.extractMetadata(testAudioBuffer)
    expect(result).toHaveProperty('duration')
    expect(result).toHaveProperty('format')
    expect(typeof result.duration).toBe('number')
    expect(typeof result.format).toBe('string')
  }, 10000)

  test('extractMetadata fallback returns estimated duration', async () => {
    if (!isFFprobeAvailable) {
      const result = await audioProcessorService.extractMetadata(testAudioBuffer)
      expect(result.duration).toBeGreaterThanOrEqual(0)
    } else {
      expect(true).toBe(true) // Skip if ffprobe is available
    }
  })

  // =====================================================
  // INTEGRATION TESTS
  // =====================================================

  test('service instance is available', () => {
    expect(audioProcessorService).toBeDefined()
    expect(typeof audioProcessorService.normalizeVolume).toBe('function')
    expect(typeof audioProcessorService.trimSilence).toBe('function')
    expect(typeof audioProcessorService.convertFormat).toBe('function')
    expect(typeof audioProcessorService.extractMetadata).toBe('function')
  })

  test('all methods handle null input gracefully', async () => {
    await expect(audioProcessorService.normalizeVolume(null as any)).rejects.toThrow()
    await expect(audioProcessorService.trimSilence(null as any)).rejects.toThrow()
    await expect(audioProcessorService.convertFormat(null as any, 'mp3')).rejects.toThrow()
    await expect(audioProcessorService.extractMetadata(null as any)).rejects.toThrow()
  })

  test('all methods return promises', () => {
    const result1 = audioProcessorService.normalizeVolume(testAudioBuffer)
    const result2 = audioProcessorService.trimSilence(testAudioBuffer)
    const result3 = audioProcessorService.convertFormat(testAudioBuffer, 'mp3')
    const result4 = audioProcessorService.extractMetadata(testAudioBuffer)

    expect(result1).toBeInstanceOf(Promise)
    expect(result2).toBeInstanceOf(Promise)
    expect(result3).toBeInstanceOf(Promise)
    expect(result4).toBeInstanceOf(Promise)
  })
})
