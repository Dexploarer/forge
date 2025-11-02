/**
 * AudioPlayer Component
 * Reusable audio player with playback controls
 */

import { useRef, useState, useEffect } from 'react'
import { Play, Pause, Volume2, VolumeX, Download } from 'lucide-react'
import { Button } from './Button'

export interface AudioPlayerProps {
  url: string | null
  title?: string
  onDownload?: () => void
  autoPlay?: boolean
  className?: string
}

export function AudioPlayer({
  url,
  title,
  onDownload,
  autoPlay = false,
  className = '',
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleLoadedMetadata = () => {
      setDuration(audio.duration)
      setIsLoading(false)
    }

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
    }

    const handleEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
    }

    const handleError = () => {
      setError('Failed to load audio')
      setIsLoading(false)
      setIsPlaying(false)
    }

    const handleLoadStart = () => {
      setIsLoading(true)
      setError(null)
    }

    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)
    audio.addEventListener('loadstart', handleLoadStart)

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
      audio.removeEventListener('loadstart', handleLoadStart)
    }
  }, [url])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume
    }
  }, [volume])

  useEffect(() => {
    if (audioRef.current && autoPlay && url) {
      handlePlayPause()
    }
  }, [url, autoPlay])

  const handlePlayPause = async () => {
    const audio = audioRef.current
    if (!audio) return

    try {
      if (isPlaying) {
        audio.pause()
        setIsPlaying(false)
      } else {
        await audio.play()
        setIsPlaying(true)
      }
    } catch (err) {
      setError('Failed to play audio')
      setIsPlaying(false)
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current
    if (!audio) return

    const time = parseFloat(e.target.value)
    audio.currentTime = time
    setCurrentTime(time)
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value)
    setVolume(newVolume)
    setIsMuted(newVolume === 0)
  }

  const toggleMute = () => {
    if (isMuted) {
      setVolume(1)
      setIsMuted(false)
    } else {
      setVolume(0)
      setIsMuted(true)
    }
  }

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (!url) {
    return (
      <div className={`bg-slate-800 border border-slate-700 rounded-lg p-4 ${className}`}>
        <p className="text-gray-400 text-sm text-center">No audio file available</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`bg-slate-800 border border-slate-700 rounded-lg p-4 ${className}`}>
        <p className="text-red-400 text-sm text-center">{error}</p>
      </div>
    )
  }

  return (
    <div className={`bg-slate-800 border border-slate-700 rounded-lg p-4 ${className}`}>
      <audio ref={audioRef} src={url} preload="metadata" />

      {/* Title */}
      {title && (
        <div className="mb-3">
          <h4 className="text-white text-sm font-medium truncate">{title}</h4>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-3">
        {/* Play/Pause Button */}
        <button
          onClick={handlePlayPause}
          disabled={isLoading}
          className="w-10 h-10 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 rounded-full flex items-center justify-center text-white transition-colors shrink-0"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : isPlaying ? (
            <Pause size={20} fill="currentColor" />
          ) : (
            <Play size={20} fill="currentColor" className="ml-0.5" />
          )}
        </button>

        {/* Progress Bar */}
        <div className="flex-1 flex items-center gap-2">
          <span className="text-xs text-gray-400 tabular-nums min-w-[40px]">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            disabled={isLoading}
            className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600 disabled:cursor-not-allowed"
            style={{
              background: `linear-gradient(to right, rgb(37, 99, 235) 0%, rgb(37, 99, 235) ${
                (currentTime / duration) * 100
              }%, rgb(51, 65, 85) ${(currentTime / duration) * 100}%, rgb(51, 65, 85) 100%)`,
            }}
          />
          <span className="text-xs text-gray-400 tabular-nums min-w-[40px]">
            {formatTime(duration)}
          </span>
        </div>

        {/* Volume Control */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={handleVolumeChange}
            className="w-20 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
            style={{
              background: `linear-gradient(to right, rgb(37, 99, 235) 0%, rgb(37, 99, 235) ${
                volume * 100
              }%, rgb(51, 65, 85) ${volume * 100}%, rgb(51, 65, 85) 100%)`,
            }}
            aria-label="Volume"
          />
        </div>

        {/* Download Button */}
        {onDownload && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDownload}
            className="gap-2 shrink-0"
          >
            <Download size={16} />
          </Button>
        )}
      </div>
    </div>
  )
}
