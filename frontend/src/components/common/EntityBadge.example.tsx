/**
 * EntityBadge & QuickActions - Example Usage
 *
 * This file demonstrates how to use the EntityBadge and QuickActions components
 * in a card layout. You can delete this file - it's just for reference.
 */

import { EntityBadge } from './EntityBadge'
import { QuickActions } from './QuickActions'
import { Card } from './Card'

export function ExampleUsage() {
  return (
    <div className="space-y-4 p-6 bg-slate-900">
      {/* Example 1: Card with badge and quick actions */}
      <Card className="relative">
        {/* Badge positioned at top-right */}
        <div className="absolute top-3 right-3">
          <EntityBadge type="featured" />
        </div>

        <div className="p-4">
          <h3 className="text-lg font-semibold text-white mb-2">Featured Asset</h3>
          <p className="text-gray-400 mb-4">
            This is a featured asset with quick actions
          </p>

          {/* Quick actions at bottom */}
          <QuickActions
            onView={() => console.log('View clicked')}
            onClone={() => console.log('Clone clicked')}
            onFavorite={() => console.log('Favorite clicked')}
            onDelete={() => console.log('Delete clicked')}
            isFavorited={false}
          />
        </div>
      </Card>

      {/* Example 2: All badge types */}
      <div className="flex flex-wrap gap-2">
        <EntityBadge type="featured" />
        <EntityBadge type="template" />
        <EntityBadge type="published" />
        <EntityBadge type="draft" />
        <EntityBadge type="new" />
      </div>

      {/* Example 3: Favorited item with limited actions */}
      <Card>
        <div className="p-4">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-lg font-semibold text-white">My Template</h3>
            <EntityBadge type="template" />
          </div>
          <p className="text-gray-400 mb-4">
            A template with only view and favorite actions
          </p>
          <QuickActions
            onView={() => console.log('View clicked')}
            onFavorite={() => console.log('Favorite clicked')}
            isFavorited={true}
          />
        </div>
      </Card>

      {/* Example 4: Draft with clone and delete */}
      <Card>
        <div className="p-4">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-lg font-semibold text-white">Draft Asset</h3>
            <EntityBadge type="draft" />
          </div>
          <p className="text-gray-400 mb-4">
            Work in progress - can clone or delete
          </p>
          <QuickActions
            onClone={() => console.log('Clone clicked')}
            onDelete={() => console.log('Delete clicked')}
          />
        </div>
      </Card>
    </div>
  )
}
