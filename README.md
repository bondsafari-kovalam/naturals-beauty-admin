# Naturals Beauty Academy — Admin

Private content-management panel for the Naturals Beauty Academy website
([`naturals-beauty-web`](https://github.com/bondsafari-kovalam/naturals-beauty-web)).
Both projects use the **same Supabase project**. Database migrations live in the website repo
under `supabase/migrations/`.

## How access works

- Sign-in uses **Supabase Auth** (email + password). Public sign-up must be **turned off** in Supabase.
- A user is an admin **only if their user ID is in `public.admin_users`**. The database function
  `public.is_admin()` checks this, and every Row Level Security policy for admin writes uses it.
- This app uses **only the publishable key**. It never needs a secret / service-role key: even a
  forged request can only do what RLS allows for that signed-in user.
- `proxy.ts` refreshes the session and redirects signed-out visitors to `/login`.
  The real check is in `lib/dal.ts`, called by **every page and every Server Action**.

## Modules (Stage 1)

| Route | What it does |
|---|---|
| `/` | Dashboard: course counts, new enquiries, latest enquiries |
| `/courses` | List, search, filter, paginate, publish/unpublish, create, edit, delete courses |
| `/enquiries` | List, search, filter by status, follow-up status + notes, delete, CSV export |
| `/testimonials` | Create, edit, publish/unpublish, delete the student testimonials shown on the homepage |
| `/account` | Change password, sign out |

## Setup

Requires **Node.js 22 or later**.

1. In Supabase SQL Editor, run (in order) from `naturals-beauty-web/supabase/migrations/`:
     `001_enquiries.sql`, `002_courses.sql`, `003_courses_seed.sql`, `004_admin_auth.sql`, `005_course_images_storage.sql`, `006_faculty.sql`, `007_workshops.sql`, `008_course_categories.sql`, `009_blog.sql`, `010_workshop_campaigns.sql` and `011_testimonials.sql`.
2. Create the first admin (instructions at the bottom of `004_admin_auth.sql`):
   Authentication → Users → Add user (auto-confirm) → run the `insert into public.admin_users …` statement.
3. Authentication → Sign In / Providers → turn **off** “Allow new users to sign up”.
4. Copy `.env.example` to `.env.local` and fill in the Project URL and **publishable** key
   (Project Settings → API Keys). Set `NEXT_PUBLIC_PUBLIC_SITE_URL` to the website address.
5. Install and run:

```bash
npm install
npm run dev -- -p 3001    # the public website uses port 3000
```

Open http://localhost:3001 and sign in.

## Checks

```bash
npx next typegen && npx tsc --noEmit
npm run lint
npm run build
```

## Deployment (Vercel)

Create a **separate** Vercel project from this repo (e.g. `admin.naturalsbeautyacademypro.com`),
set the three `NEXT_PUBLIC_*` variables from `.env.example`, and Node.js 22+.
In Supabase → Authentication → URL Configuration, add the admin URL to the allowed redirect URLs.
