/**
 * Help Page
 * Help and documentation center
 */

import { HelpCircle, ChevronDown, ExternalLink, Search } from 'lucide-react'
import { useState } from 'react'
import { DashboardLayout } from '../components/dashboard/DashboardLayout'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
} from '../components/common'

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)

  const faqs = [
    {
      question: 'How do I upload assets?',
      answer:
        'Navigate to the Assets page and click the "Upload Asset" button. You can drag and drop files or browse to select them. Supported formats include 3D models (GLB, GLTF, FBX), textures (PNG, JPG), and audio files (MP3, WAV).',
    },
    {
      question: 'What AI models are supported?',
      answer:
        'Forge supports multiple AI models including OpenAI GPT-4, Claude (Anthropic), Meshy for 3D generation, and ElevenLabs for voice synthesis. You can configure your preferred models in Settings.',
    },
    {
      question: 'How is billing calculated?',
      answer:
        'Billing is based on AI usage, storage, and generated assets. Each AI service call is tracked with token counts and costs. You can view detailed usage analytics in the Analytics page.',
    },
  ]

  const toggleFaq = (index: number) => {
    setExpandedFaq(expandedFaq === index ? null : index)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Page Header */}
        <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl backdrop-blur-sm p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <HelpCircle size={28} className="text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Help & Documentation</h1>
              <p className="text-gray-400 mt-1">
                Get help and learn how to use Forge
              </p>
            </div>
          </div>
        </div>

        {/* Search Documentation */}
        <div className="relative">
          <Search
            size={20}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <Input
            type="text"
            placeholder="Search documentation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Getting Started */}
        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
            <CardDescription>Learn the basics of using Forge</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <li className="flex items-start gap-3 p-3 bg-slate-800 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors">
                <div className="w-2 h-2 bg-blue-400 rounded-full mt-1.5"></div>
                <div>
                  <h4 className="text-sm font-medium text-white">Create your first project</h4>
                  <p className="text-xs text-gray-400 mt-1">
                    Set up a new game project with AI configuration and team collaboration
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3 p-3 bg-slate-800 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors">
                <div className="w-2 h-2 bg-blue-400 rounded-full mt-1.5"></div>
                <div>
                  <h4 className="text-sm font-medium text-white">Upload assets</h4>
                  <p className="text-xs text-gray-400 mt-1">
                    Import 3D models, textures, audio files, and more to your project library
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3 p-3 bg-slate-800 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors">
                <div className="w-2 h-2 bg-blue-400 rounded-full mt-1.5"></div>
                <div>
                  <h4 className="text-sm font-medium text-white">Generate game content with AI</h4>
                  <p className="text-xs text-gray-400 mt-1">
                    Use AI to create NPCs, quests, lore, music, voice, and 3D assets
                  </p>
                </div>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Features */}
        <Card>
          <CardHeader>
            <CardTitle>Features</CardTitle>
            <CardDescription>Explore what you can do with Forge</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
              <h4 className="text-sm font-semibold text-white mb-2">Asset Management</h4>
              <p className="text-xs text-gray-400">
                Upload, organize, and manage 3D models, textures, audio files, and game assets.
                Track metadata, versions, and usage across your projects.
              </p>
            </div>

            <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
              <h4 className="text-sm font-semibold text-white mb-2">AI Content Generation</h4>
              <p className="text-xs text-gray-400">
                Generate NPCs with personalities, create rich lore and world-building content,
                design quests with objectives and rewards, and build multi-agent AI systems
                for collaborative content creation.
              </p>
            </div>

            <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
              <h4 className="text-sm font-semibold text-white mb-2">Voice & Audio Production</h4>
              <p className="text-xs text-gray-400">
                Create music tracks with stems and BPM detection, generate sound effects with
                categories and parameters, synthesize character voices with ElevenLabs, and
                manage NPC voice assignments.
              </p>
            </div>

            <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
              <h4 className="text-sm font-semibold text-white mb-2">Analytics & Reporting</h4>
              <p className="text-xs text-gray-400">
                Track AI usage and costs, monitor team activity, analyze asset usage patterns,
                and generate detailed reports for project insights.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Keyboard Shortcuts */}
        <Card>
          <CardHeader>
            <CardTitle>Keyboard Shortcuts</CardTitle>
            <CardDescription>Work faster with keyboard shortcuts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg border border-slate-700">
                <span className="text-sm text-gray-300">Global search</span>
                <kbd className="px-2 py-1 text-xs font-semibold text-white bg-slate-900 border border-slate-600 rounded">
                  ⌘K
                </kbd>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg border border-slate-700">
                <span className="text-sm text-gray-300">Show help</span>
                <kbd className="px-2 py-1 text-xs font-semibold text-white bg-slate-900 border border-slate-600 rounded">
                  ?
                </kbd>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg border border-slate-700">
                <span className="text-sm text-gray-300">Settings</span>
                <kbd className="px-2 py-1 text-xs font-semibold text-white bg-slate-900 border border-slate-600 rounded">
                  ,
                </kbd>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FAQ */}
        <Card>
          <CardHeader>
            <CardTitle>Frequently Asked Questions</CardTitle>
            <CardDescription>Common questions and answers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="border border-slate-700 rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full flex items-center justify-between p-4 bg-slate-800 hover:bg-slate-750 transition-colors"
                >
                  <span className="text-sm font-medium text-white text-left">
                    {faq.question}
                  </span>
                  <ChevronDown
                    size={18}
                    className={`text-gray-400 transition-transform ${
                      expandedFaq === index ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {expandedFaq === index && (
                  <div className="p-4 bg-slate-900/50 border-t border-slate-700">
                    <p className="text-sm text-gray-300">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Support */}
        <Card>
          <CardHeader>
            <CardTitle>Support</CardTitle>
            <CardDescription>Get additional help and resources</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="primary"
              className="w-full justify-center"
              onClick={() => window.open('mailto:support@forge.dev', '_blank')}
            >
              Contact Support
            </Button>

            <button
              onClick={() => window.open('https://docs.forge.dev', '_blank')}
              className="w-full flex items-center justify-between p-3 bg-slate-800 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors"
            >
              <span className="text-sm font-medium text-white">Documentation</span>
              <ExternalLink size={16} className="text-gray-400" />
            </button>

            <button
              onClick={() => window.open('https://community.forge.dev', '_blank')}
              className="w-full flex items-center justify-between p-3 bg-slate-800 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors"
            >
              <span className="text-sm font-medium text-white">Community Forum</span>
              <ExternalLink size={16} className="text-gray-400" />
            </button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
