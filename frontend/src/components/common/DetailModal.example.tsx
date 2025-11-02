/**
 * DetailModal Usage Example
 * This file demonstrates how to use the DetailModal component
 */

import { useState } from 'react'
import { DetailModal } from './DetailModal'
import { Button } from './Button'

export function DetailModalExample() {
  const [isOpen, setIsOpen] = useState(false)

  // Example NPC entity
  const npcEntity = {
    id: 'npc-001',
    name: 'Eldrin the Wise',
    type: 'npc' as const,
    avatarUrl: 'https://via.placeholder.com/160',
    description:
      'An ancient wizard who guards the secrets of the forgotten realm. Known for his vast knowledge of arcane magic and mysterious past.',
    badges: ['featured', 'published'] as Array<'featured' | 'template' | 'published' | 'draft'>,
    overview: (
      <div className="space-y-4">
        <section>
          <h3 className="text-lg font-semibold text-white mb-2">Character Background</h3>
          <p className="text-gray-300">
            Eldrin has lived for over 300 years, studying the ancient arts of magic. He serves as
            the guardian of the Crystal Tower, a mystical structure that holds the balance between
            the realms of light and shadow.
          </p>
        </section>
        <section>
          <h3 className="text-lg font-semibold text-white mb-2">Personality</h3>
          <ul className="list-disc list-inside text-gray-300 space-y-1">
            <li>Wise and patient, but can be cryptic</li>
            <li>Values knowledge above all else</li>
            <li>Has a dry sense of humor</li>
            <li>Protective of those who seek true wisdom</li>
          </ul>
        </section>
      </div>
    ),
    quests: (
      <div className="space-y-3">
        <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
          <h4 className="font-semibold text-white mb-2">The Lost Scroll</h4>
          <p className="text-gray-300 text-sm">
            Retrieve the ancient scroll of binding from the Shadow Caves.
          </p>
        </div>
        <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
          <h4 className="font-semibold text-white mb-2">Crystal Restoration</h4>
          <p className="text-gray-300 text-sm">
            Help restore the damaged crystals in the tower's upper chamber.
          </p>
        </div>
      </div>
    ),
    lore: (
      <div className="space-y-4">
        <p className="text-gray-300">
          The Crystal Tower was built during the Age of Enlightenment, when magic flowed freely
          through the world. Eldrin was chosen as its guardian after proving his dedication to
          preserving magical knowledge.
        </p>
        <p className="text-gray-300">
          Legend says he once prevented a catastrophic magical collapse that would have destroyed
          the entire realm. Since then, he has devoted himself to maintaining the balance and
          teaching worthy apprentices.
        </p>
      </div>
    ),
    technical: (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-gray-400 text-sm">Entity ID</span>
            <p className="text-white font-mono">npc-001</p>
          </div>
          <div>
            <span className="text-gray-400 text-sm">Created</span>
            <p className="text-white">2025-11-01</p>
          </div>
          <div>
            <span className="text-gray-400 text-sm">Last Modified</span>
            <p className="text-white">2025-11-02</p>
          </div>
          <div>
            <span className="text-gray-400 text-sm">Version</span>
            <p className="text-white">1.2.0</p>
          </div>
        </div>
      </div>
    ),
  }

  return (
    <div className="p-8">
      <Button onClick={() => setIsOpen(true)}>Open Detail Modal</Button>

      <DetailModal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        entity={npcEntity}
        onEdit={() => console.log('Edit clicked')}
        onDelete={() => console.log('Delete clicked')}
        onClone={() => console.log('Clone clicked')}
        onShare={() => console.log('Share clicked')}
      />
    </div>
  )
}
