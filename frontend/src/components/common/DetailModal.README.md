# DetailModal Component

A comprehensive modal component for displaying detailed entity information with a hero section, tabs, and action buttons.

## Location

`/Users/home/forge/frontend/src/components/common/DetailModal.tsx`

## Features

- **Hero Section**: Large avatar, entity name, type badge, status badges, description, and action buttons
- **Dynamic Tabs**: Only shows tabs with content provided
- **Responsive Design**: Full screen on mobile, XL modal on desktop
- **Dark Theme**: Consistent with application styling
- **TypeScript**: Full type safety with comprehensive props interface
- **Accessible**: Proper ARIA labels and keyboard navigation

## Usage

```tsx
import { DetailModal } from '@/components/common'

function MyComponent() {
  const [isOpen, setIsOpen] = useState(false)

  const entity = {
    id: 'entity-001',
    name: 'Entity Name',
    type: 'npc', // 'npc' | 'quest' | 'asset' | 'lore'
    avatarUrl: 'https://example.com/avatar.jpg',
    description: 'Brief description of the entity',
    badges: ['featured', 'published'],
    // Tab content (optional)
    overview: <div>Overview content</div>,
    quests: <div>Quest information</div>,
    lore: <div>Lore and background</div>,
    technical: <div>Technical details</div>,
  }

  return (
    <DetailModal
      open={isOpen}
      onClose={() => setIsOpen(false)}
      entity={entity}
      onEdit={() => console.log('Edit')}
      onDelete={() => console.log('Delete')}
      onClone={() => console.log('Clone')}
      onShare={() => console.log('Share')}
    />
  )
}
```

## Props Interface

```typescript
interface DetailModalProps {
  open: boolean
  onClose: () => void
  entity: {
    id: string
    name: string
    type: 'npc' | 'quest' | 'asset' | 'lore'
    avatarUrl?: string | null
    description: string
    badges?: Array<'featured' | 'template' | 'published' | 'draft'>
    // Tab content (all optional)
    overview?: ReactNode
    assets?: ReactNode
    lore?: ReactNode
    quests?: ReactNode
    locations?: ReactNode
    technical?: ReactNode
  }
  // Action handlers (all optional)
  onEdit?: () => void
  onDelete?: () => void
  onClone?: () => void
  onShare?: () => void
}
```

## Entity Types

Each entity type has a unique color scheme:

- **NPC**: Purple badge
- **Quest**: Orange badge
- **Asset**: Blue badge
- **Lore**: Green badge

## Badge Types

Status badges have predefined variants:

- **Featured**: Warning variant (orange)
- **Template**: Primary variant (blue)
- **Published**: Success variant (green)
- **Draft**: Secondary variant (gray)

## Available Tabs

Tabs are automatically shown based on content provided:

1. **Overview** - General information (icon: User)
2. **Assets** - Related assets (icon: Database)
3. **Lore** - Background and lore (icon: Scroll)
4. **Quests** - Associated quests (icon: Scroll)
5. **Locations** - Location information (icon: MapPin)
6. **Technical** - Technical details (icon: Database)

Only tabs with content will be displayed. At least one tab is recommended.

## Action Buttons

All action buttons are optional:

- **Edit** (Primary) - Triggers `onEdit` callback
- **Clone** (Secondary) - Triggers `onClone` callback
- **Share** (Ghost) - Triggers `onShare` callback
- **Delete** (Danger) - Triggers `onDelete` callback

## Styling

- Modal size: `xl` (max-w-4xl)
- Avatar size: 160px × 160px circular
- Hero section: Gradient background (slate-800 to slate-900)
- Content area: Max height 50vh with scrolling
- Responsive breakpoint: Mobile stacks at `md` breakpoint

## Dependencies

- `Modal`, `ModalBody` - Base modal components
- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` - Tab components
- `Button` - Action button component
- `Badge` - Status badge component
- `lucide-react` - Icons (Edit2, Trash2, Copy, Share2, User, Scroll, Database, MapPin)

## Example

See `DetailModal.example.tsx` for a complete working example with an NPC entity.

## Keyboard Navigation

- **Escape**: Closes the modal
- **Tab Navigation**: Navigate between action buttons and tabs
- **Arrow Keys**: Navigate between tabs (when focused)

## Accessibility

- Proper ARIA labels on close button
- Role attributes on modal and tabs
- Keyboard navigation support
- Focus management
