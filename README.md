# GymNae — Supabase Edition

A browser-only GitHub Pages website with Tetris, local two-player chess, 2048, Supabase group/direct messaging, and a scores leaderboard. No installation or billing information is needed when the services' Free plans are available.

## GitHub Pages
1. Create or open your public GitHub repository `gymnae`.
2. Upload **these six files** to the repository root: `index.html`, `styles.css`, `app.js`, `supabase-config.js`, `supabase-schema.sql`, `README.md` (the SQL file is only used in the Supabase dashboard; uploading is optional).
3. Start with a new repository named `gymnae`. Your old project can remain untouched or be deleted later if you wish.
4. GitHub repository → Settings → Pages → Deploy from branch → main → /(root) → Save.
5. Open `https://YOUR-GITHUB-USERNAME.github.io/gymnae/`.

## Supabase setup
1. Create a project on the **Free** plan at https://supabase.com/dashboard (no paid upgrade). You need access to an email address to register and potentially confirm accounts.
2. Open **SQL Editor → New query**, paste the complete `supabase-schema.sql` file and press **Run**. It creates tables and row-level security policies for profiles, messages, and scores, plus Realtime subscriptions.
3. Open **Project Settings → API Keys** (or Connect) and copy the **Project URL** and **publishable key** (or legacy **anon** key). Never copy the `service_role` or secret key.
4. In GitHub edit `supabase-config.js`: replace the two placeholder strings, then commit.
5. In **Authentication → Providers → Email**, enable email/password. Supabase generally requires email confirmation unless you change that setting. Add your GitHub Pages URL under **Authentication → URL Configuration → Site URL**; include the website URL under Redirect URLs if required for confirmations.
6. Open the site, sign up using your own email and a unique password, confirm the email if prompted, then log in.
7. Test with two accounts: send a group message and a DM. Play a game and submit a score.

## Safety and limitations
- Games should work even without connecting Supabase, except chess depends on jsDelivr for chess.js.
- Supabase and jsDelivr may be blocked by school restrictions. Do not use this project to evade school or family controls. Use allowed devices and services.
- **Never put the Supabase `service_role` or a secret key in public GitHub files.** Publishable / anon keys are safe only with correctly configured Row Level Security (RLS).
- Group messages are visible to all signed-in members. DMs are readable by the two participants, not end-to-end encrypted. User directory lists display names, not emails.
- Player-submitted scores are **not cheat-resistant** without a trusted backend. No automatic moderation/block/report flow is included; keep this to a small trusted group, and add controls before expanding.
- Email confirmation requires an accessible email inbox. Free service quotas, availability, and provider age requirements apply. Free projects may pause after inactivity.
- SQL schema is designed for a new Supabase project; review modifications before running on an existing database.
