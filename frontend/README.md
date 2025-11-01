# Forge Frontend

Modern React + TypeScript frontend for the Forge game asset management platform.

## Tech Stack

- **React 19** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **Privy** - Web3-native authentication (wallet + email + social)

## Getting Started

### Prerequisites

- Bun >= 1.0.0
- Privy App ID (get one at https://dashboard.privy.io)

### Installation

1. Install dependencies:
```bash
bun install
```

2. Create `.env` file:
```env
VITE_PRIVY_APP_ID=your-privy-app-id
VITE_API_URL=http://localhost:3000
```

3. Start development server:
```bash
bun dev
```

The app will be available at http://localhost:5173

## Features

### Authentication
- Email login
- Wallet connection (Ethereum, etc.)
- Google OAuth
- Farcaster login

### Pages
- **Login Page** (`/`) - Dark gradient login screen with Privy integration
- **Dashboard** (`/dashboard`) - Main app interface with project stats and quick actions
- **Admin Panel** (`/admin`) - Comprehensive admin interface with:
  - **Overview Tab** - Platform statistics and quick actions
  - **Users Tab** - User management with role assignments
  - **Activity Tab** - Real-time platform activity feed
  - **Whitelist Tab** - Wallet whitelist management

## Project Structure

```
frontend/
├── src/
│   ├── pages/
│   │   ├── LoginPage.tsx      # Login/authentication page
│   │   └── DashboardPage.tsx  # Main dashboard
│   ├── components/            # Reusable components
│   ├── App.tsx               # Main app component
│   ├── main.tsx              # Entry point with Privy provider
│   └── index.css             # Global styles with Tailwind
├── .env                      # Environment variables (not committed)
└── vite.config.ts           # Vite configuration
```

## Scripts

```bash
bun dev        # Start development server
bun run build  # Build for production
bun run preview # Preview production build
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_PRIVY_APP_ID` | Privy application ID | Yes |
| `VITE_API_URL` | Backend API URL | Yes |

## License

Same as parent project
