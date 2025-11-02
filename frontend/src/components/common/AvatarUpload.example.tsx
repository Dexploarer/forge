/**
 * AvatarUpload Component Examples
 * Demonstrates various configurations of the AvatarUpload component
 */

import { useState } from 'react'
import { AvatarUpload } from './AvatarUpload'

export function AvatarUploadExamples() {
  const [avatar1, setAvatar1] = useState<string | null>(null)
  const [avatar2, setAvatar2] = useState<string | null>(
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix'
  )
  const [avatar3, setAvatar3] = useState<string | null>(null)
  const [avatar4, setAvatar4] = useState<string | null>(null)

  // Handle file upload - typically you'd upload to your backend here
  const handleFileChange = (
    file: File | null,
    setAvatar: (url: string | null) => void
  ) => {
    if (file) {
      // Create a local preview URL
      const url = URL.createObjectURL(file)
      setAvatar(url)

      // In production, you would upload the file to your backend:
      // const formData = new FormData()
      // formData.append('avatar', file)
      // const response = await fetch('/api/upload/avatar', {
      //   method: 'POST',
      //   body: formData,
      // })
      // const data = await response.json()
      // setAvatar(data.url)
    } else {
      setAvatar(null)
    }
  }

  // Handle URL input
  const handleUrlChange = (
    url: string,
    setAvatar: (url: string | null) => void
  ) => {
    setAvatar(url)
  }

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-6xl mx-auto space-y-12">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            AvatarUpload Component
          </h1>
          <p className="text-gray-400">
            Upload and preview avatar images with drag-and-drop support
          </p>
        </div>

        {/* Size Variants */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-white">Size Variants</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-300">Small (80px)</h3>
              <AvatarUpload
                size="sm"
                value={avatar1}
                onChange={(file) => handleFileChange(file, setAvatar1)}
              />
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-300">Medium (120px)</h3>
              <AvatarUpload
                size="md"
                value={avatar1}
                onChange={(file) => handleFileChange(file, setAvatar1)}
              />
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-300">Large (160px)</h3>
              <AvatarUpload
                size="lg"
                value={avatar1}
                onChange={(file) => handleFileChange(file, setAvatar1)}
              />
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-300">Extra Large (200px)</h3>
              <AvatarUpload
                size="xl"
                value={avatar1}
                onChange={(file) => handleFileChange(file, setAvatar1)}
              />
            </div>
          </div>
        </section>

        {/* Shape Variants */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-white">Shape Variants</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-300">Circle</h3>
              <AvatarUpload
                size="lg"
                shape="circle"
                value={avatar2}
                onChange={(file) => handleFileChange(file, setAvatar2)}
              />
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-300">Rounded</h3>
              <AvatarUpload
                size="lg"
                shape="rounded"
                value={avatar2}
                onChange={(file) => handleFileChange(file, setAvatar2)}
              />
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-300">Square</h3>
              <AvatarUpload
                size="lg"
                shape="square"
                value={avatar2}
                onChange={(file) => handleFileChange(file, setAvatar2)}
              />
            </div>
          </div>
        </section>

        {/* With URL Input */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-white">
            With URL Input Option
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-300">
                Upload File or Paste URL
              </h3>
              <AvatarUpload
                size="lg"
                value={avatar3}
                onChange={(file) => handleFileChange(file, setAvatar3)}
                onUrlChange={(url) => handleUrlChange(url, setAvatar3)}
              />
              <p className="text-xs text-gray-500">
                Try pasting: https://api.dicebear.com/7.x/avataaars/svg?seed=Test
              </p>
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-300">Current Value</h3>
              <div className="bg-slate-800 rounded-lg p-4">
                <code className="text-xs text-gray-400 break-all">
                  {avatar3 || 'null'}
                </code>
              </div>
            </div>
          </div>
        </section>

        {/* States */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-white">Component States</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-300">Normal</h3>
              <AvatarUpload
                size="md"
                value={avatar4}
                onChange={(file) => handleFileChange(file, setAvatar4)}
              />
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-300">With Avatar</h3>
              <AvatarUpload
                size="md"
                value="https://api.dicebear.com/7.x/avataaars/svg?seed=State"
                onChange={(file) => handleFileChange(file, setAvatar4)}
              />
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-300">Disabled</h3>
              <AvatarUpload
                size="md"
                value="https://api.dicebear.com/7.x/avataaars/svg?seed=Disabled"
                onChange={(file) => handleFileChange(file, setAvatar4)}
                disabled
              />
            </div>
          </div>
        </section>

        {/* Real-World Usage Example */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-white">
            Real-World Example: Profile Settings
          </h2>
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-4">
                  Profile Picture
                </label>
                <AvatarUpload
                  size="xl"
                  value={avatar1}
                  onChange={(file) => handleFileChange(file, setAvatar1)}
                  onUrlChange={(url) => handleUrlChange(url, setAvatar1)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Display Name
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                    placeholder="Enter your name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                    placeholder="@username"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* Usage Code */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-white">Usage Code</h2>
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <pre className="text-sm text-gray-300 overflow-x-auto">
              <code>{`import { useState } from 'react'
import { AvatarUpload } from '@/components/common/AvatarUpload'

function ProfileForm() {
  const [avatar, setAvatar] = useState<string | null>(null)

  const handleFileChange = async (file: File | null) => {
    if (file) {
      // Upload to your backend
      const formData = new FormData()
      formData.append('avatar', file)

      const response = await fetch('/api/upload/avatar', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()
      setAvatar(data.url)
    } else {
      setAvatar(null)
    }
  }

  return (
    <AvatarUpload
      value={avatar}
      onChange={handleFileChange}
      onUrlChange={setAvatar}
      size="lg"
      shape="circle"
    />
  )
}`}</code>
            </pre>
          </div>
        </section>
      </div>
    </div>
  )
}
