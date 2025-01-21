# CMS Restart Project

A modern CMS built with React, Vite, and Supabase, featuring authentication, role-based access control, and workflow management.

## Tech Stack
- React + Vite for frontend
- Supabase for backend (Auth, Database)
- TailwindCSS for styling
- React Router for navigation

## Project Structure
```
├── src/
│   ├── components/     # Reusable UI components
│   ├── lib/           # Utility functions and configurations
│   ├── pages/         # Page components
│   ├── routes/        # Route definitions
│   └── auth.jsx       # Authentication components
├── supabase/
│   └── schema/        # Database schema files
│       ├── 0_extensions.sql      # PostgreSQL extensions
│       ├── 1_organizations.sql   # Organization structure
│       ├── 2_user_profiles.sql   # User profiles and roles
│       └── 3_workflows.sql       # Workflow management
```

## Features
- **Authentication**: Email-based authentication with Supabase
- **Role-Based Access Control**: Support for admin, agent, and customer roles
- **Organization Management**: Multi-tenant support with organization-based data isolation
- **Workflow Management**: Configurable workflows with stages and hooks

## Setup

1. **Environment Variables**
   Create a `.env` file with:
   ```
   VITE_SUPABASE_URL=your_project_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Database Setup**
   Run the schema files in order in Supabase SQL Editor:
   - `0_extensions.sql`: Enable PostgreSQL extensions
   - `1_organizations.sql`: Create organization structure
   - `2_user_profiles.sql`: Set up user profiles and roles
   - `3_workflows.sql`: Configure workflow management

4. **Development Server**
   ```bash
   npm run dev
   ```

## Development

### Branch Strategy
- `main`: Production-ready code
- `feature/*`: New features and improvements
- `fix/*`: Bug fixes

### Database Schema
The schema is organized in numbered files to manage dependencies:
1. Extensions setup
2. Organization structure
3. User profiles and authentication
4. Workflow management

Each schema file is idempotent and can be safely re-run.

## Security
- Row Level Security (RLS) enabled on all tables
- Role-based access control for all operations
- Secure authentication flow with Supabase
- Environment variables for sensitive configuration
