# SocialAI Frontend

A modern React application built with shadcn/ui components, Tailwind CSS, and TypeScript for managing social media presence with AI-powered insights.

## Features

- **Modern UI**: Built with shadcn/ui components and Tailwind CSS
- **Authentication**: JWT-based authentication with your existing backend
- **Dashboard**: Real-time analytics and AI content suggestions
- **Business Profile**: Manage business information for personalized AI suggestions
- **Responsive Design**: Works on desktop and mobile devices

## Backend Integration

This frontend is designed to work with your existing backend API at `https://aisocial.dev/api` and includes:

### Authentication
- Login/Register functionality
- JWT token management
- Protected routes

### Dashboard Features
- Google Analytics integration
- Instagram statistics
- AI content suggestions with refresh functionality
- Real-time data visualization

### Business Profile
- Create and update business information
- Target audience definition
- Social media goals setting

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create environment file:
```bash
echo "VITE_API_BASE_URL=https://aisocial.dev/api" > .env
```

3. Start development server:
```bash
npm run dev
```

4. Open [http://localhost:5173](http://localhost:5173) in your browser

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # shadcn/ui components
│   └── Navigation.tsx  # Main navigation
├── contexts/           # React contexts
│   └── AuthContext.tsx # Authentication context
├── lib/               # Utilities and API
│   └── api.ts         # Backend API integration
├── pages/             # Page components
│   ├── Dashboard.tsx  # Main dashboard
│   ├── Login.tsx      # Authentication page
│   ├── BusinessProfile.tsx # Business profile form
│   └── ...
└── hooks/             # Custom React hooks
```

## API Integration

The frontend integrates with your backend through the following endpoints:

### Authentication
- `POST /auth/login` - User login
- `POST /auth/register` - User registration
- `POST /auth/google-login` - Google OAuth login

### Dashboard
- `GET /analytics/site-visits` - Google Analytics data
- `GET /instagram/monthly` - Instagram statistics
- `GET /ai/suggestions` - AI content suggestions
- `PUT /ai/suggestions/:id/refresh` - Refresh suggestions

### Business Profile
- `GET /business-profile/:userId` - Get business profile
- `PUT /business-profile/:userId` - Update business profile

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Technologies Used

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **shadcn/ui** - Component library
- **React Router** - Navigation
- **Axios** - HTTP client
- **Recharts** - Data visualization
- **Lucide React** - Icons

## Deployment

The application can be deployed to any static hosting service:

1. Build the application:
```bash
npm run build
```

2. Deploy the `dist` folder to your hosting service

## Environment Variables

- `VITE_API_BASE_URL` - Backend API base URL (default: https://aisocial.dev/api)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License.
