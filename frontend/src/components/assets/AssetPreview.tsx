/**
 * Asset Preview Component
 * Displays different asset types (3D models, textures, audio) appropriately
 */

import { useState, useRef, useEffect } from 'react'
import { ModelViewer } from './ModelViewer'
import { Volume2, Play, Pause, Image as ImageIcon, FileQuestion } from 'lucide-react'
import { Button } from '../common'

interface AssetPreviewProps {
  type: 'model' | 'texture' | 'audio' | 'other'
  fileUrl: string
  name: string
  mimeType?: string
  className?: string
}

function ImagePreview({ fileUrl, name }: { fileUrl: string; name: string }) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-slate-900/50 rounded-lg">
      {!imageLoaded && !imageError && (
        <div className="absolute inset-0 flex items-center justify-center">
          <ImageIcon size={48} className="text-gray-600 animate-pulse" />
        </div>
      )}
      {imageError ? (
        <div className="text-center p-8">
          <ImageIcon size={48} className="text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Failed to load image</p>
        </div>
      ) : (
        <img
          src={fileUrl}
          alt={name}
          className="max-w-full max-h-full object-contain rounded-lg"
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageError(true)}
        />
      )}
    </div>
  )
}

function AudioPreview({ fileUrl, name }: { fileUrl: string; name: string }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const updateTime = () => setCurrentTime(audio.currentTime)
    const updateDuration = () => setDuration(audio.duration)
    const handleEnded = () => setIsPlaying(false)

    audio.addEventListener('timeupdate', updateTime)
    audio.addEventListener('loadedmetadata', updateDuration)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.removeEventListener('timeupdate', updateTime)
      audio.removeEventListener('loadedmetadata', updateDuration)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [])

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    setCurrentTime(time)
    if (audioRef.current) {
      audioRef.current.currentTime = time
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 bg-slate-900/50 rounded-lg">
      <audio ref={audioRef} src={fileUrl} preload="metadata" />

      <div className="w-full max-w-md space-y-6">
        {/* Waveform Visualization (Placeholder) */}
        <div className="flex items-center justify-center h-32 bg-slate-800 rounded-lg border border-slate-700">
          <Volume2 size={48} className="text-blue-400" />
        </div>

        {/* Controls */}
        <div className="space-y-4">
          {/* Play Button */}
          <div className="flex justify-center">
            <Button
              variant="primary"
              size="lg"
              onClick={togglePlay}
              className="rounded-full w-16 h-16 p-0 flex items-center justify-center"
            >
              {isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
            </Button>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* File Name */}
          <div className="text-center">
            <p className="text-sm text-gray-300 font-medium truncate">{name}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function UnsupportedPreview({ type }: { type: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 bg-slate-900/50 rounded-lg">
      <FileQuestion size={64} className="text-gray-600 mb-4" />
      <p className="text-gray-400 text-lg font-medium mb-2">Preview not available</p>
      <p className="text-gray-500 text-sm">Type: {type}</p>
    </div>
  )
}

export function AssetPreview({ type, fileUrl, name, mimeType, className = '' }: AssetPreviewProps) {
  if (!fileUrl) {
    return (
      <div className={`flex items-center justify-center bg-slate-900/50 rounded-lg p-8 ${className}`}>
        <p className="text-gray-400">No file uploaded yet</p>
      </div>
    )
  }

  // Determine preview type
  const isModel = type === 'model' || mimeType?.includes('gltf') || mimeType?.includes('glb')
  const isImage = type === 'texture' || mimeType?.startsWith('image/')
  const isAudio = type === 'audio' || mimeType?.startsWith('audio/')

  return (
    <div className={`h-full ${className}`}>
      {isModel && <ModelViewer url={fileUrl} className="h-full min-h-[400px]" />}
      {isImage && <ImagePreview fileUrl={fileUrl} name={name} />}
      {isAudio && <AudioPreview fileUrl={fileUrl} name={name} />}
      {!isModel && !isImage && !isAudio && <UnsupportedPreview type={type} />}
    </div>
  )
}
