/**
 * CharacterCard Example Usage
 * This file demonstrates how to use the CharacterCard component
 */

import { CharacterCard } from './CharacterCard'

export function CharacterCardExample() {
  return (
    <div className="p-8 bg-slate-900 min-h-screen">
      <h1 className="text-2xl font-bold text-white mb-6">CharacterCard Examples</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Example 1: Featured Character with Avatar */}
        <CharacterCard
          id="1"
          name="Eliza"
          handle="eliza_ai"
          description="A helpful AI assistant focused on mental health and emotional support. Specializes in therapeutic conversations and empathetic responses."
          avatarUrl="https://api.dicebear.com/7.x/avataaars/svg?seed=Eliza"
          badges={['featured', 'published']}
          tags={['AI Assistant', 'Mental Health', 'Therapy']}
          stats={{
            usageCount: 15234,
            favorites: 892,
            interactions: 45678,
          }}
          onClick={() => console.log('View character: Eliza')}
          onClone={() => console.log('Clone character: Eliza')}
          onInfo={() => console.log('Info for character: Eliza')}
        />

        {/* Example 2: Template Character without Avatar */}
        <CharacterCard
          id="2"
          name="Game Master"
          handle="gm_template"
          description="A versatile template for creating dungeon masters and game facilitators. Perfect for tabletop RPG experiences."
          badges={['template']}
          tags={['RPG', 'D&D', 'Storytelling', 'Game Master']}
          stats={{
            usageCount: 8901,
            favorites: 456,
          }}
          onClick={() => console.log('View character: Game Master')}
          onClone={() => console.log('Clone character: Game Master')}
          onInfo={() => console.log('Info for character: Game Master')}
        />

        {/* Example 3: Draft Character */}
        <CharacterCard
          id="3"
          name="Wizard Mentor"
          handle="wizard_draft"
          description="Work in progress: A wise wizard character for fantasy adventures and magical guidance."
          badges={['draft']}
          tags={['Fantasy', 'Magic', 'Mentor']}
          onClick={() => console.log('View character: Wizard Mentor')}
          onInfo={() => console.log('Info for character: Wizard Mentor')}
        />

        {/* Example 4: Multiple Badges */}
        <CharacterCard
          id="4"
          name="Captain Navigator"
          handle="captain_nav"
          description="Featured space exploration guide with proven track record. Available as template for custom missions."
          avatarUrl="https://api.dicebear.com/7.x/avataaars/svg?seed=Captain"
          badges={['featured', 'template', 'published']}
          tags={['Sci-Fi', 'Space', 'Exploration', 'Leadership', 'Strategy']}
          stats={{
            usageCount: 23456,
            favorites: 1234,
            interactions: 78901,
          }}
          onClick={() => console.log('View character: Captain Navigator')}
          onClone={() => console.log('Clone character: Captain Navigator')}
          onInfo={() => console.log('Info for character: Captain Navigator')}
        />

        {/* Example 5: Minimal Character */}
        <CharacterCard
          id="5"
          name="Bob"
          description="A simple character for testing purposes."
          onClick={() => console.log('View character: Bob')}
        />

        {/* Example 6: Long Description with Many Tags */}
        <CharacterCard
          id="6"
          name="Professor Analytics"
          handle="prof_data"
          description="An expert in data science, machine learning, and statistical analysis. Provides detailed explanations of complex mathematical concepts and helps with research projects. Always ready to dive deep into the numbers and extract meaningful insights."
          avatarUrl="https://api.dicebear.com/7.x/avataaars/svg?seed=Professor"
          badges={['published']}
          tags={['Data Science', 'Machine Learning', 'Statistics', 'Research', 'Mathematics', 'Analytics']}
          stats={{
            usageCount: 12000,
            favorites: 678,
            interactions: 34567,
          }}
          onClick={() => console.log('View character: Professor Analytics')}
          onClone={() => console.log('Clone character: Professor Analytics')}
          onInfo={() => console.log('Info for character: Professor Analytics')}
        />
      </div>
    </div>
  )
}
