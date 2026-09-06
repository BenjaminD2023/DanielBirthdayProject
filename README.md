# DanielBirthdayProject

## Decision tracker

Every confirmed letter opening is recorded with the participant name, browser identity, choice number, visible-tab picking time, and database submission time. After the first letter, the original “Kidding.” reveal lets visitors continue browsing. Reopening a letter counts as another choice. A letter opens only after saving succeeds; retries of the same request do not create duplicate records.

Timing starts when the carousel appears and stops at confirmation. Each subsequent choice starts a fresh timer, excluding time spent reading, on the reveal, or in a hidden tab. The timer restarts if the page reloads before submission.

Enter the admin password in the homepage name field to open `/admin`, or log in directly at `/admin`. The password is checked on the server and exchanged for an HttpOnly, eight-hour session cookie; it is never bundled in the frontend or saved in browser storage. The long homepage password is masked once it exceeds the 32-character name limit.

Admins can select **Test letters**, **Choose again**, or **Admin records**. Test submissions are labeled `[Test]` and have a separate choice sequence from the browser's normal visits. Log out to return to participant mode.

A persistent cookie groups choices from the same browser across refreshes, restarts, and name changes. There is no choice limit. Clearing cookies, private browsing, or switching browsers creates a separate history. The private `letter_decision_history` view numbers each browser's records in insertion order before the admin API limits its response to the newest 500 records.

For Vercel:

1. Add `SUPABASE_URL` and `SUPABASE_SECRET_KEY` as sensitive environment variables. Never prefix the secret with `VITE_`.
2. Add `ADMIN_PASSWORD` as a sensitive environment variable.
3. Deploy.

The `letter_decisions` table has RLS enabled with no public policies. Only the server API can read or write it. The history view uses `security_invoker` and is readable only by the server role. Apply `supabase/migrations/20260906140403_track_every_letter_choice.sql` to the existing database before deploying this version; it preserves existing records and replaces the one-choice constraint with request deduplication.

For local API testing, use `vercel dev` after pulling the same variables into `.env.local`. Vite alone runs the participant UI but not the `/api/tracker` function.
