

# IT Asset Management System

A professional IT asset management system designed to track physical and digital assets, manage employee assignments, monitor asset lifecycles, and analyze cost analytics.

## Features

- **Asset Lifecycle Management**: Track hardware, software, and digital assets from acquisition, assignment, maintenance, through disposal.
- **Employee & Assignment Tracking**: Seamlessly assign devices and equipment to employees with complete assignment histories.
- **Cost Analytics**: Visual dashboards showcasing asset distributions, valuation, and expense breakdowns using charts.
- **Administrative Settings**: Managing user accounts, custom system keys, and secure configuration profiles.
- **Multi-Factor Authentication (MFA/2FA)**: Fully supports secure Authenticator-based Multi-Factor Authentication with admin reset capabilities.
- **Clean Responsive UI**: Designed with sleek modern design patterns, ambient slate themes, custom motion transitions, and interactive components.

## Tech Stack

- **Frontend**: React 18+, Vite, Tailwind CSS, Motion (Animations)
- **Icons**: Lucide React
- **Data Visualization**: Recharts, D3
- **Database/Backend Integration**: Supabase (PostgreSQL client / Mock Client fallback)

## Getting Started

### Prerequisites

Make sure you have [Node.js](https://nodejs.org/) installed on your machine.

### Installation

1. Unzip/extract the project files into your desired folder.
2. Open your terminal or Command Prompt in that folder:
   ```bash
   cd "C:\Users\MdMahasinHowlader\Downloads\Assets Manager"
   ```
3. Install the dependencies:
   ```bash
   npm install
   ```

### Environment Configuration

Create a `.env` file in the root directory of your project (same level as `package.json`). Populate it with your database and API credentials (see `.env.example` as a template):

```env
# Database Credentials (e.g., Supabase)
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### Run the Application

Start the local development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) (or the port shown in your terminal) in your browser to view the application.

### Build for Production

Compile the production-ready optimized static build:
```bash
npm run build
```
The static assets will be outputted to the `dist` folder, ready to be hosted on Netlify, Vercel, or any other hosting provider.
