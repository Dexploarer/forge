// =====================================================
// AUDIO PROCESSOR SERVICE
// =====================================================
// Audio file processing utilities (normalization, trimming, conversion, metadata)

import ffmpeg from 'fluent-ffmpeg'
import { env } from '../config/env'
import { PassThrough, Readable } from 'stream'
import { promisify } from 'util'
import { exec } from 'child_process'

const execAsync = promisify(exec)

export interface AudioMetadata {
  duration: number // seconds
  format: string
  sampleRate: number | undefined
  channels: number | undefined
  bitrate: number | undefined
  codec: string | undefined
}

export class AudioProcessorService {
  private ffmpegAvailable: boolean | null = null
  private ffprobeAvailable: boolean | null = null

  constructor() {
    // Set custom ffmpeg/ffprobe paths if provided
    if (env.FFMPEG_PATH) {
      ffmpeg.setFfmpegPath(env.FFMPEG_PATH)
    }
    if (env.FFPROBE_PATH) {
      ffmpeg.setFfprobePath(env.FFPROBE_PATH)
    }
  }

  /**
   * Check if ffmpeg is available on the system
   */
  async checkFfmpegAvailable(): Promise<boolean> {
    if (this.ffmpegAvailable !== null) {
      return this.ffmpegAvailable
    }

    try {
      const command = env.FFMPEG_PATH || 'ffmpeg'
      await execAsync(`${command} -version`)
      this.ffmpegAvailable = true
      return true
    } catch (error) {
      console.warn('FFmpeg not found. Audio processing features will be limited.')
      this.ffmpegAvailable = false
      return false
    }
  }

  /**
   * Check if ffprobe is available on the system
   */
  async checkFfprobeAvailable(): Promise<boolean> {
    if (this.ffprobeAvailable !== null) {
      return this.ffprobeAvailable
    }

    try {
      const command = env.FFPROBE_PATH || 'ffprobe'
      await execAsync(`${command} -version`)
      this.ffprobeAvailable = true
      return true
    } catch (error) {
      console.warn('FFprobe not found. Metadata extraction will use estimation.')
      this.ffprobeAvailable = false
      return false
    }
  }

  /**
   * Convert Buffer to Readable stream
   */
  private bufferToStream(buffer: Buffer): Readable {
    const stream = new Readable()
    stream.push(buffer)
    stream.push(null)
    return stream
  }

  /**
   * Convert stream to Buffer
   */
  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
      stream.on('error', reject)
      stream.on('end', () => resolve(Buffer.concat(chunks)))
    })
  }

  /**
   * Normalize audio volume to a target level
   */
  async normalizeVolume(audioBuffer: Buffer, targetLevel: number = -16): Promise<Buffer> {
    // Validate input
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('Invalid audio buffer')
    }

    if (targetLevel < -70 || targetLevel > 0) {
      throw new Error('Target level must be between -70 and 0 dB')
    }

    // Check if ffmpeg is available
    const isAvailable = await this.checkFfmpegAvailable()
    if (!isAvailable) {
      console.log('FFmpeg not available. Returning original buffer without normalization.')
      return audioBuffer
    }

    try {
      console.log('Normalizing audio volume to:', targetLevel, 'dB')

      const inputStream = this.bufferToStream(audioBuffer)
      const outputStream = new PassThrough()

      return new Promise((resolve, reject) => {
        ffmpeg(inputStream)
          .audioFilters([
            {
              filter: 'loudnorm',
              options: {
                I: targetLevel,
                TP: -1.5,
                LRA: 11,
              },
            },
          ])
          .format('mp3')
          .on('error', (err) => {
            console.error('FFmpeg normalization error:', err.message)
            reject(new Error(`Audio normalization failed: ${err.message}`))
          })
          .on('end', () => {
            console.log('Audio normalization completed successfully')
          })
          .pipe(outputStream)

        this.streamToBuffer(outputStream)
          .then(resolve)
          .catch(reject)
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to normalize audio: ${message}`)
    }
  }

  /**
   * Trim silence from beginning and end of audio
   */
  async trimSilence(audioBuffer: Buffer, threshold: number = -40): Promise<Buffer> {
    // Validate input
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('Invalid audio buffer')
    }

    if (threshold < -60 || threshold > 0) {
      throw new Error('Threshold must be between -60 and 0 dB')
    }

    // Check if ffmpeg is available
    const isAvailable = await this.checkFfmpegAvailable()
    if (!isAvailable) {
      console.log('FFmpeg not available. Returning original buffer without trimming.')
      return audioBuffer
    }

    try {
      console.log('Trimming silence with threshold:', threshold, 'dB')

      const inputStream = this.bufferToStream(audioBuffer)
      const outputStream = new PassThrough()

      return new Promise((resolve, reject) => {
        ffmpeg(inputStream)
          .audioFilters([
            {
              filter: 'silenceremove',
              options: {
                start_periods: 1,
                start_threshold: `${threshold}dB`,
                stop_periods: 1,
                stop_threshold: `${threshold}dB`,
                detection: 'peak',
              },
            },
          ])
          .format('mp3')
          .on('error', (err) => {
            console.error('FFmpeg silence trimming error:', err.message)
            reject(new Error(`Silence trimming failed: ${err.message}`))
          })
          .on('end', () => {
            console.log('Silence trimming completed successfully')
          })
          .pipe(outputStream)

        this.streamToBuffer(outputStream)
          .then(resolve)
          .catch(reject)
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to trim silence: ${message}`)
    }
  }

  /**
   * Convert audio to different format
   */
  async convertFormat(audioBuffer: Buffer, targetFormat: string): Promise<Buffer> {
    // Validate input
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('Invalid audio buffer')
    }

    if (!this.isSupportedFormat(targetFormat)) {
      throw new Error(`Unsupported target format: ${targetFormat}. Supported formats: mp3, wav, ogg, flac, m4a, aac`)
    }

    // Check if ffmpeg is available
    const isAvailable = await this.checkFfmpegAvailable()
    if (!isAvailable) {
      console.log('FFmpeg not available. Returning original buffer without conversion.')
      return audioBuffer
    }

    try {
      console.log('Converting audio to format:', targetFormat)

      const inputStream = this.bufferToStream(audioBuffer)
      const outputStream = new PassThrough()

      // Determine codec based on format
      const codecMap: Record<string, string> = {
        mp3: 'libmp3lame',
        wav: 'pcm_s16le',
        ogg: 'libvorbis',
        flac: 'flac',
        m4a: 'aac',
        aac: 'aac',
      }

      const codec = codecMap[targetFormat.toLowerCase()] || 'libmp3lame'

      return new Promise((resolve, reject) => {
        ffmpeg(inputStream)
          .audioCodec(codec)
          .format(targetFormat)
          .on('error', (err) => {
            console.error('FFmpeg conversion error:', err.message)
            reject(new Error(`Audio conversion failed: ${err.message}`))
          })
          .on('end', () => {
            console.log('Audio conversion completed successfully')
          })
          .pipe(outputStream)

        this.streamToBuffer(outputStream)
          .then(resolve)
          .catch(reject)
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to convert audio format: ${message}`)
    }
  }

  /**
   * Extract metadata from audio file
   */
  async extractMetadata(audioBuffer: Buffer): Promise<AudioMetadata> {
    // Validate input
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('Invalid audio buffer')
    }

    // Check if ffprobe is available
    const isAvailable = await this.checkFfprobeAvailable()
    if (!isAvailable) {
      console.log('FFprobe not available. Using estimation for metadata.')
      // Fallback to estimation
      const estimatedDuration = Math.floor(audioBuffer.length / 16000)
      return {
        duration: estimatedDuration,
        format: 'unknown',
        sampleRate: 44100,
        channels: 2,
        bitrate: 128000,
        codec: 'unknown',
      }
    }

    try {
      console.log('Extracting metadata from audio buffer of size:', audioBuffer.length)

      const inputStream = this.bufferToStream(audioBuffer)

      return new Promise((resolve) => {
        ffmpeg.ffprobe(inputStream as any, (err, metadata) => {
          if (err) {
            console.error('FFprobe error:', err.message)
            // Fallback to estimation on error
            const estimatedDuration = Math.floor(audioBuffer.length / 16000)
            resolve({
              duration: estimatedDuration,
              format: 'unknown',
              sampleRate: 44100,
              channels: 2,
              bitrate: 128000,
              codec: 'unknown',
            })
            return
          }

          // Extract audio stream information
          const audioStream = metadata.streams.find(s => s.codec_type === 'audio')

          if (!audioStream) {
            // No audio stream found, use estimation
            const estimatedDuration = Math.floor(audioBuffer.length / 16000)
            resolve({
              duration: estimatedDuration,
              format: metadata.format.format_name || 'unknown',
              sampleRate: 44100,
              channels: 2,
              bitrate: metadata.format.bit_rate ? parseInt(String(metadata.format.bit_rate), 10) : 128000,
              codec: 'unknown',
            })
            return
          }

          const result: AudioMetadata = {
            duration: parseFloat(String(audioStream.duration || metadata.format.duration || '0')),
            format: metadata.format.format_name || 'unknown',
            sampleRate: audioStream.sample_rate ? parseInt(String(audioStream.sample_rate), 10) : undefined,
            channels: audioStream.channels,
            bitrate: audioStream.bit_rate ? parseInt(String(audioStream.bit_rate), 10) :
                     (metadata.format.bit_rate ? parseInt(String(metadata.format.bit_rate), 10) : undefined),
            codec: audioStream.codec_name,
          }

          console.log('Metadata extracted successfully:', result)
          resolve(result)
        })
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('Failed to extract metadata:', message)

      // Fallback to estimation on any error
      const estimatedDuration = Math.floor(audioBuffer.length / 16000)
      return {
        duration: estimatedDuration,
        format: 'unknown',
        sampleRate: 44100,
        channels: 2,
        bitrate: 128000,
        codec: 'unknown',
      }
    }
  }

  /**
   * Validate audio buffer
   */
  validateAudioBuffer(buffer: Buffer, maxSize: number = 100 * 1024 * 1024): boolean {
    if (!buffer || buffer.length === 0) {
      return false
    }

    if (buffer.length > maxSize) {
      return false
    }

    return true
  }

  /**
   * Get estimated duration from file size (rough approximation)
   */
  estimateDuration(fileSize: number, bitrate: number = 128000): number {
    // duration in seconds = (fileSize in bytes * 8) / bitrate
    return Math.floor((fileSize * 8) / bitrate)
  }

  /**
   * Check if format is supported
   */
  isSupportedFormat(format: string): boolean {
    const supportedFormats = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac']
    return supportedFormats.includes(format.toLowerCase())
  }

  /**
   * Get recommended format based on use case
   */
  getRecommendedFormat(useCase: 'music' | 'sfx' | 'voice'): string {
    switch (useCase) {
      case 'music':
        return 'mp3' // Good compression, wide support
      case 'sfx':
        return 'wav' // No compression, low latency
      case 'voice':
        return 'mp3' // Good compression for speech
      default:
        return 'mp3'
    }
  }

  /**
   * Check overall service availability
   */
  async isAvailable(): Promise<{ ffmpeg: boolean; ffprobe: boolean }> {
    const [ffmpegAvail, ffprobeAvail] = await Promise.all([
      this.checkFfmpegAvailable(),
      this.checkFfprobeAvailable(),
    ])

    return {
      ffmpeg: ffmpegAvail,
      ffprobe: ffprobeAvail,
    }
  }
}

export const audioProcessorService = new AudioProcessorService()
