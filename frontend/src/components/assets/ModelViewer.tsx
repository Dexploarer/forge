/**
 * 3D Model Viewer Component
 * Displays GLB/GLTF models from MinIO storage using Three.js
 */

import { Suspense, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, useGLTF, Environment, PerspectiveCamera } from '@react-three/drei'
import { Loader, AlertCircle, RotateCcw, Maximize2 } from 'lucide-react'
import { Button } from '../common'

interface ModelViewerProps {
  url: string
  className?: string
  autoRotate?: boolean
}

interface ModelProps {
  url: string
}

function Model({ url }: ModelProps) {
  const gltf = useGLTF(url) as any
  const meshRef = useRef<any>(null)

  // Auto-rotate the model
  useFrame((_state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.3
    }
  })

  return <primitive ref={meshRef} object={gltf.scene} />
}

export function ModelViewer({ url, className = '', autoRotate = true }: ModelViewerProps) {
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [resetCamera, setResetCamera] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const handleLoaded = () => {
    setIsLoading(false)
    setError(null)
  }

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center bg-slate-900/50 rounded-lg border border-slate-700 p-8 ${className}`}>
        <AlertCircle size={48} className="text-red-400 mb-4" />
        <p className="text-red-400 font-medium mb-2">Failed to load 3D model</p>
        <p className="text-gray-400 text-sm text-center">{error}</p>
      </div>
    )
  }

  return (
    <div className={`relative ${isFullscreen ? 'fixed inset-0 z-50' : ''} ${className}`}>
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-10 rounded-lg">
          <div className="flex flex-col items-center gap-3">
            <Loader size={32} className="text-blue-400 animate-spin" />
            <p className="text-gray-300 text-sm">Loading 3D model...</p>
          </div>
        </div>
      )}

      {/* Controls Overlay */}
      <div className="absolute top-4 right-4 z-20 flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setResetCamera(resetCamera + 1)}
          title="Reset Camera"
          className="bg-slate-800/90 hover:bg-slate-700"
        >
          <RotateCcw size={16} />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          className="bg-slate-800/90 hover:bg-slate-700"
        >
          <Maximize2 size={16} />
        </Button>
      </div>

      {/* 3D Canvas */}
      <div className={`bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg border border-slate-700 overflow-hidden ${isFullscreen ? 'h-screen' : 'h-full'}`}>
        <Canvas
          camera={{ position: [0, 0, 5], fov: 50 }}
          onCreated={() => handleLoaded()}
        >
          <Suspense fallback={null}>
            {/* Lighting */}
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 5]} intensity={1} />
            <directionalLight position={[-10, -10, -5]} intensity={0.3} />
            <pointLight position={[0, 10, 0]} intensity={0.5} />

            {/* Environment */}
            <Environment preset="studio" />

            {/* Camera Controls */}
            <PerspectiveCamera makeDefault position={[0, 0, 5]} />
            <OrbitControls
              enablePan
              enableZoom
              enableRotate
              autoRotate={autoRotate}
              autoRotateSpeed={0.5}
              minDistance={1}
              maxDistance={20}
              key={resetCamera}
            />

            {/* 3D Model */}
            <Model url={url} />
          </Suspense>
        </Canvas>
      </div>

      {/* Fullscreen Instructions */}
      {!isLoading && !isFullscreen && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
          <div className="bg-slate-800/90 text-xs text-gray-300 px-3 py-2 rounded-full border border-slate-600">
            Left-click: Rotate • Right-click: Pan • Scroll: Zoom
          </div>
        </div>
      )}
    </div>
  )
}
