# JobTracker SaaS - Product Requirements Document

## Original Problem Statement
Build a professional SaaS-style job tracking application called "Job Tracking" / "JobTracker". The application helps job seekers organize their job search, track applications, manage interviews, and improve their chances of success through AI-powered insights.

## Target Users
- Active job seekers
- Career changers
- Students/bootcamp graduates
- Career coaches and schools (B2B)

## Core Requirements

### User-Facing Features
1. **Application Tracking**: Centralized dashboard to track all job applications
2. **Interview Management**: Calendar view, reminders, preparation notes
3. **Statistics & Insights**: Response rates, weekly progress, Job Search Score
4. **AI Advisor**: Personalized recommendations for improving job search
5. **Chrome Extension**: Quick-add job postings from LinkedIn, Indeed, etc.
6. **Documents**: Store CVs, cover letters, and other documents

### Admin Features
1. **User Management**: View, edit, activate/deactivate users
2. **User Creation**: Admins can create new user accounts
3. **Analytics Dashboard**: Global statistics, user growth, activity metrics

## What's Been Implemented

### Phase 1 - Core MVP (Completed)
- [x] User authentication (JWT-based)
- [x] Application CRUD operations
- [x] Interview management
- [x] Basic statistics
- [x] Settings page
- [x] PWA support

### Phase 2 - Dashboard V2 (Completed - Feb 2026)
- [x] Job Search Score (composite score 0-100)
- [x] Monthly goal tracking with progress bar
- [x] Rule-based insights (AI-like recommendations)
- [x] Weekly evolution chart
- [x] Priority actions

### Phase 3 - Chrome Extension Auth (Completed - Feb 2026)
- [x] Direct email/password login in extension
- [x] One-click "Quick Connect" via temporary code
- [x] JWT storage in chrome.storage.sync
- [x] Deployment documentation

### Phase 4 - Admin Features (Completed - Feb 2026)
- [x] Admin dashboard with statistics
- [x] User list with search/filter
- [x] User detail view
- [x] User edit (role, status)
- [x] User creation by admin
- [x] Loading skeletons

### Phase 5 - Landing Page & UI (Completed - Feb 2026)
- [x] Professional SaaS landing page
- [x] Honest messaging (organization tool, not magic)
- [x] Hero illustration
- [x] Global font-size adjustment (14px base)
- [x] Dashboard card spacing improvement

## Architecture

```
/app/
├── backend/
│   ├── models/__init__.py    # Pydantic models
│   ├── routes/
│   │   ├── auth.py           # Authentication + extension auth
│   │   ├── applications.py   # CRUD applications
│   │   ├── interviews.py     # Interview management
│   │   ├── statistics.py     # Dashboard V2 logic
│   │   ├── admin.py          # Admin panel + user creation
│   │   └── ...
│   └── server.py             # FastAPI main
├── frontend/
│   ├── src/
│   │   ├── pages/            # React pages
│   │   ├── components/ui/    # Shadcn components
│   │   ├── hooks/            # Custom hooks
│   │   └── contexts/         # Auth, Refresh contexts
│   └── public/               # Static assets
└── chrome-extension/         # Browser extension
```

## Key API Endpoints
- `POST /api/auth/login` - User login
- `POST /api/auth/extension/generate-code` - Generate temp code for extension
- `POST /api/auth/extension/verify-code` - Verify temp code
- `POST /api/statistics/dashboard-v2` - Dashboard V2 data
- `POST /api/admin/users` - Create user (admin only)
- `GET /api/admin/users` - List users (admin only)

## Credentials
- Admin: `admin@test.com` / `password123`
- Demo: `demo@test.com` / `password123`

## Prioritized Backlog

### P0 (Next)
- [ ] Theme switching (Light/Dark/System)
- [ ] Dashboard spacing fine-tuning if needed

### P1
- [ ] Offline mode (PWA Cache First + IndexedDB)
- [ ] Student features (reminders, interview notes bank)
- [ ] Google Calendar integration (currently mocked)

### P2
- [ ] B2B multi-tenant features
- [ ] Production deployment (Vercel + MongoDB Atlas)
- [ ] Stripe monetization

## Known Issues
- Sidebar scroll on small screens (not verified)
- Google Calendar integration is mocked (UI only)

## Tech Stack
- **Backend**: FastAPI, MongoDB, APScheduler
- **Frontend**: React, Tailwind CSS, Shadcn UI, Framer Motion, Recharts
- **Auth**: JWT tokens
- **AI**: emergentintegrations (OpenAI, Gemini, Groq)
