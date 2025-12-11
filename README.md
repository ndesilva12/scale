# Loyalty

A visual tool for plotting and rating group members on customizable metrics. Create groups, define custom metrics, and see your team members plotted on an interactive 2D graph based on crowdsourced ratings.

## Features

- **Interactive 2D Graph**: Plot team members on a graph with selectable X and Y axis metrics
- **Custom Metrics**: Create up to 10 custom metrics per group (e.g., Leadership, Creativity, Technical Skill)
- **Crowdsourced Ratings**: All group members rate each other (including self-ratings)
- **Aggregated Scores**: View averaged scores calculated from all member ratings
- **Real-time Updates**: Scores and visualizations update in real-time as ratings are submitted
- **Member Profiles**: Click on member avatars to view detailed score breakdowns
- **Data Table View**: See all scores in a tabular format
- **Responsive Design**: Works on desktop and mobile devices

## Tech Stack

- **Frontend**: Next.js 14 with TypeScript
- **Styling**: Tailwind CSS
- **Authentication**: Clerk
- **Database**: Firebase/Firestore
- **Real-time**: Firestore real-time listeners

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Clerk account (for authentication)
- Firebase project (for database)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/ndesilva12/loyalty.git
   cd loyalty
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```

4. Configure your environment variables in `.env.local`:
   - Add your Clerk publishable and secret keys
   - Add your Firebase configuration

5. Run the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

### Demo Mode

Visit `/demo` to see the application with mock data without needing to set up authentication or database.

## Project Structure

```
src/
├── app/                  # Next.js app router pages
│   ├── dashboard/        # User dashboard
│   ├── demo/            # Demo page with mock data
│   ├── groups/          # Group and member pages
│   ├── sign-in/         # Clerk sign-in page
│   └── sign-up/         # Clerk sign-up page
├── components/          # React components
│   ├── graph/           # Graph visualization components
│   ├── groups/          # Group management components
│   ├── layout/          # Layout components (Header)
│   └── ui/              # Reusable UI components
├── hooks/               # Custom React hooks
├── lib/                 # Utilities and configurations
│   ├── firebase.ts      # Firebase configuration
│   ├── firestore.ts     # Firestore operations
│   └── mockData.ts      # Mock data for demo
└── types/               # TypeScript type definitions
```

## Key Concepts

### Groups
Groups are created by users and contain:
- A name and description
- Up to 10 custom metrics
- Members who can rate each other

### Members
Members can be:
- **Active**: Accepted the invitation and can submit ratings
- **Placeholder**: Added by the creator but haven't joined yet

### Ratings
- Each member rates all other members (and themselves) on each metric
- Ratings are on a 0-100 scale
- Final scores are averages of all ratings received

### Invitations & Claims
- Creators can invite members by email
- Users receive invitations on their dashboard
- Placeholder profiles can be "claimed" by users who believe it represents them

## Environment Variables

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

## License

MIT
