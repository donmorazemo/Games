# Drop By

Leave your porch light on. Let friends know when you're home.

Drop By revives the culture of unannounced drop-in visits — set recurring open hours for your friend circles, and friends can see when your door is open tonight.

---

## Quick Start (VS Code + Web Browser)

### 1. Install dependencies

Open the `DropBy` folder in VS Code, open a terminal, and run:

```bash
cd DropBy
npm install
```

### 2. Set up Supabase

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project called `dropby`
3. In the left sidebar → **SQL Editor** → **New query**
4. Paste the contents of `supabase/schema.sql` and click **Run**
5. Go to **Project Settings → API** and copy:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **anon / public** key

### 3. Set up Google OAuth

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project called `dropby`
3. Enable the **Google Calendar API**
4. Go to **OAuth consent screen** → External → fill in app name "Drop By"
5. Go to **Credentials → Create OAuth client ID**:
   - Create one for **Web application** → copy the Client ID + Secret
   - Create one for **iOS** with bundle ID `com.dropby.app` → copy the Client ID
6. Back in Supabase → **Authentication → Providers → Google** → paste the Web Client ID + Secret → Save

### 4. Configure the app

Open `app.json` and replace the placeholder values in the `extra` section:

```json
"extra": {
  "supabaseUrl": "https://xxxx.supabase.co",
  "supabaseAnonKey": "eyJ...",
  "googleClientId": "YOUR_IOS_CLIENT_ID.apps.googleusercontent.com",
  "googleWebClientId": "YOUR_WEB_CLIENT_ID.apps.googleusercontent.com"
}
```

### 5. Deploy Supabase edge functions

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase functions deploy create-drop-by-intent
npx supabase functions deploy cancel-drop-by-intent
```

Your project ref is the string between `https://` and `.supabase.co` in your project URL.

### 6. Run the app

```bash
npm run web
```

This opens the app in your browser at `http://localhost:8081`.

---

## Project Structure

```
DropBy/
├── app/                        # Expo Router navigation
│   ├── _layout.tsx             # Root layout — auth gate
│   ├── (auth)/                 # Unauthenticated screens
│   │   └── index.tsx           # Welcome / sign in
│   └── (tabs)/                 # Authenticated tab screens
│       ├── tonight.tsx         # Tonight view
│       ├── circles.tsx         # Circles list
│       ├── circles/[id].tsx    # Circle detail + member management
│       ├── my-hours.tsx        # My open hours management
│       └── activity.tsx        # Notifications
├── src/
│   ├── types/index.ts          # TypeScript interfaces
│   ├── utils/theme.ts          # Colors, spacing, shadows
│   ├── lib/supabase.ts         # Supabase client
│   ├── services/
│   │   ├── auth.ts             # Google sign-in + pending invite promotion
│   │   ├── calendar.ts         # Google Calendar API integration
│   │   ├── circles.ts          # Circle CRUD
│   │   ├── windows.ts          # Open windows CRUD
│   │   └── intents.ts          # Drop-by intent creation/cancellation
│   ├── hooks/
│   │   └── useAvailability.ts  # Real-time availability computation
│   └── screens/                # Screen components
├── supabase/
│   ├── schema.sql              # Full Postgres schema + RLS policies
│   └── functions/              # Deno edge functions
│       ├── create-drop-by-intent/
│       └── cancel-drop-by-intent/
└── app.json                    # Expo config (put your keys here)
```

---

## Core Concepts

| Concept | What it means |
|---|---|
| **Circle** | A named group of friends. Each circle is also a Google Calendar. |
| **Open Window** | A recurring time block — "Fridays 7–10pm, for College Friends." |
| **Porch light on** | Your window is active and you have no calendar conflict. |
| **Drop By** | A soft one-way signal: "I plan to come over." No RSVP needed. |
| **On my way** | You've confirmed a drop-by intent — you're now marked as out to your own circles. |

---

## Status Logic

| Condition | Status shown |
|---|---|
| Open window is active now + no calendar conflict + not dropping by elsewhere | **Free — come over** |
| Has an active drop-by intent to visit someone else | **Out — dropping by a friend** |
| Has open windows but none active right now | **Not available right now** |
| No open windows set | *(not shown to others)* |

---

## Key Design Decisions

- **No RSVPs, no confirmations** — the host's door is open unconditionally. The "drop by" signal is courtesy only.
- **Calendar as storage** — each circle maps to a real Google Calendar so conflicts are detected natively.
- **Magical onboarding** — friends can be invited by email before they download the app; they arrive to find themselves already expected.
- **Privacy** — free/busy read only (no event titles), circles are closed groups (email-based discovery).
