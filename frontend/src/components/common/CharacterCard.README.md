# CharacterCard Component

A marketplace-style character card component inspired by Eliza.OS design system.

## Features

- **Responsive Design**: Works across all screen sizes with hover effects
- **Avatar Display**: Supports custom avatars or generates colorful placeholder initials
- **Badge System**: Visual indicators for character status (featured, template, published, draft)
- **Stats Display**: Shows usage count, favorites, and interaction metrics
- **Tag System**: Displays up to 3 tags with overflow indicator
- **Action Buttons**: View, Clone, and Info actions with tooltips
- **Dark Theme**: Matches the slate-800 dark theme palette
- **Smooth Animations**: Scale and shadow transitions on hover

## Usage

```tsx
import { CharacterCard } from '@/components/common/CharacterCard'

function MyMarketplace() {
  return (
    <CharacterCard
      id="1"
      name="Eliza"
      handle="eliza_ai"
      description="A helpful AI assistant focused on mental health support"
      avatarUrl="https://example.com/avatar.jpg"
      badges={['featured', 'published']}
      tags={['AI Assistant', 'Mental Health', 'Therapy']}
      stats={{
        usageCount: 15234,
        favorites: 892,
        interactions: 45678,
      }}
      onClick={() => navigate(`/character/1`)}
      onClone={() => cloneCharacter('1')}
      onInfo={() => showCharacterInfo('1')}
    />
  )
}
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | Yes | Unique identifier for the character |
| `name` | `string` | Yes | Character name |
| `description` | `string` | Yes | Character description (truncated to 3 lines) |
| `avatarUrl` | `string \| null` | No | URL to avatar image. If not provided, shows placeholder with initial |
| `handle` | `string` | No | @username style handle |
| `badges` | `Array<'featured' \| 'template' \| 'published' \| 'draft'>` | No | Status badges displayed in top-right corner |
| `tags` | `string[]` | No | Category tags (shows first 3 + overflow count) |
| `stats` | `object` | No | Usage statistics |
| `stats.usageCount` | `number` | No | Number of times character has been used |
| `stats.favorites` | `number` | No | Number of favorites |
| `stats.interactions` | `number` | No | Total interaction count |
| `onClick` | `() => void` | No | Called when card or View button is clicked |
| `onClone` | `() => void` | No | Called when Clone button is clicked. If not provided, button is hidden |
| `onInfo` | `() => void` | No | Called when Info button is clicked. If not provided, button is hidden |
| `className` | `string` | No | Additional CSS classes |

## Badge Types

- **Featured** (yellow/gold): Star icon - highlights premium or popular characters
- **Template** (blue): Copy icon - indicates reusable character templates
- **Published** (green): CheckCircle icon - shows publicly available characters
- **Draft** (orange): Edit icon - marks work-in-progress characters

## Avatar Behavior

- If `avatarUrl` is provided: Displays the image with circular crop
- If `avatarUrl` is null/undefined: Shows circular placeholder with:
  - First letter of name (uppercase)
  - Color determined by character code (8 color palette)
  - Border that changes on hover

## Action Buttons

1. **View** (Primary): Eye icon - main action to view character details
2. **Clone** (Secondary): Copy icon - duplicates the character (optional)
3. **Info** (Ghost): Info icon - shows additional information (optional)

All buttons include tooltips via `title` attribute and stop event propagation to prevent card click.

## Grid Layout Example

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {characters.map(character => (
    <CharacterCard key={character.id} {...character} />
  ))}
</div>
```

## Styling

The component uses:
- Slate-800 background with 50% opacity
- Slate-700 borders
- Blue-500 accent colors on hover
- Scale-105 transform on hover
- Shadow-xl with blue glow on hover
- 200ms transitions for smooth animations

## Dependencies

- `lucide-react`: Icons (Eye, Copy, Info, Star, FileText, CheckCircle, Edit)
- `Badge`: Custom badge component
- `Button`: Custom button component
- `cn`: Utility for className merging

## See Also

- `CharacterCard.example.tsx`: Complete usage examples
- `Badge.tsx`: Badge component
- `Button.tsx`: Button component
