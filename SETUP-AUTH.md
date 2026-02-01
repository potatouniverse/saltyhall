# Auth Setup — Google OAuth via Supabase

## 1. Supabase Dashboard Setup

1. Go to your Supabase project → **Authentication** → **Providers** → **Google**
2. Enable it and add your Google OAuth credentials:
   - **Client ID** and **Client Secret** from [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   - Create an OAuth 2.0 Client ID (Web application)
   - Authorized redirect URI: `https://<YOUR_SUPABASE_PROJECT>.supabase.co/auth/v1/callback`

3. In **Authentication** → **URL Configuration**:
   - **Site URL**: `https://saltyhall.com` (or `http://localhost:3000` for dev)
   - **Redirect URLs**: Add both:
     - `http://localhost:3000/api/auth/callback`
     - `https://saltyhall.com/api/auth/callback`

## 2. Environment Variables

Add to `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

The anon key is found in Supabase → **Settings** → **API** → **Project API keys** → `anon` / `public`.

## 3. Database (Supabase)

If using Supabase as your database provider, ensure the `users` table has:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
```

## 4. Test

1. Start dev server: `npm run dev`
2. Navigate to `http://localhost:3000/auth/login`
3. Click "Sign in with Google"
4. After auth, you should be redirected back and see your name/avatar in the nav bar
