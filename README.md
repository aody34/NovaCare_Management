# NovaCare Pharmacy Dashboard (React + Supabase)

This app is a Vite + React + Tailwind pharmacy management dashboard wired to Supabase.

## Features
- Supabase Auth login (email/password)
- Role-based access from `profiles` table (`admin` / `staff`)
- Inventory from Supabase (`medicines` table)
- POS checkout using atomic RPC (`complete_sale`) to avoid race conditions
- Transactions + transaction items persisted in Supabase
- Finance date filters (custom from/to + 30-day and 90-day quick presets)
- Settings persisted in Supabase (`settings` table)

## 1) Run `schema.sql` in Supabase SQL Editor
Open Supabase SQL Editor and execute:

`supabase/schema.sql`

This creates:
- `profiles`, `medicines`, `transactions`, `transaction_items`, `settings`
- RLS policies
- automatic profile creation trigger on `auth.users`
- admin bootstrap for `apdykadir41@gmail.com`
- atomic `complete_sale(payload jsonb)` RPC

## 2) Run `seed.sql`
In Supabase SQL Editor, execute:

`supabase/seed.sql`

This inserts:
- default store settings
- 22 retail medicines (including low-stock + expired examples)

## 3) Add env vars
Create `.env.local` in project root:

```bash
VITE_SUPABASE_URL=https://kcxmleqrwusdyfiikbmj.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
# or use publishable key name:
# VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key_here
```

The client is initialized in:
- `src/lib/supabase.js`

## 4) Create admin user, then login
In Supabase Dashboard:
1. Go to Authentication -> Users
2. Create user with email `apdykadir41@gmail.com` and your password
3. Login in the app with that email/password

On first user creation, SQL trigger inserts profile row automatically.
For `apdykadir41@gmail.com`, role is set to `admin` in SQL (not frontend).

## Local development
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```
