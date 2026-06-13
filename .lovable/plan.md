# Free vs Premium Tiers

Add a two-tier model: **Family Starter (Free)** and **Family Premium ($4.99/mo)**, with hard gates enforced both in the UI and database.

## Tier matrix

| Feature | Free | Premium |
|---|---|---|
| Child accounts | 1 | 5 |
| Chore assignment & approval | ✓ | ✓ |
| 5 jars | ✓ | ✓ |
| Allowances | Manual only | Manual + Automated weekly |
| Recurring chores | ✗ | ✓ |
| Wishlist items | Up to 3 (active) | Unlimited |
| Transaction history | Last 30 days | Full + analytics |
| AI coach sessions | 3 / month | Unlimited (all modes) |
| Customizable jar % | ✗ (defaults locked) | ✓ |
| Push notifications | ✗ | ✓ |
| Child password reset / email creds | ✗ | ✓ |
| Stripe customer portal | n/a | ✓ |
| PWA install | ✓ | ✓ |

## Database changes (migration)

1. Add to `subscription_data`:
   - `tier text not null default 'free'` (values: `free`, `premium`)
   - `ai_coach_usage_count int not null default 0`
   - `ai_coach_usage_month text` (e.g. `2026-06`) — resets on month change
2. New SECURITY DEFINER helper `public.get_user_tier(_user_id uuid) returns text` — returns `premium` if `subscribed = true` OR `on_trial` active, else `free`.
3. New RPC `public.fb_increment_ai_coach_usage(_user_id uuid) returns int` — bumps counter, auto-resets on new month, returns new count. Premium users skipped (returns -1 / unlimited).
4. Optional trigger on `children` insert: block when caller is `free` and already has ≥1 child.
5. Optional trigger on `wishlist_items` insert: block when caller is `free` and child already has ≥3 active (non-purchased) items.

## Backend (edge functions)

- **check-subscription** — return `{ tier: 'free' | 'premium', subscribed, on_trial, trial_ends_at, ai_coach_usage_count, ai_coach_limit }`.
- **ai-coach** — call `fb_increment_ai_coach_usage`; if count > 3 and tier=free, return 402 with `{ error: 'limit_reached' }`.
- **process-allowances** & **process-recurring-chores** — skip children whose parent is `free`.
- **send-push-notification** — skip free-tier parents.
- **parent-reset-child-password** / **send-child-credentials** — return 403 for free tier.

## Frontend

1. **`useSubscription` hook** — expose `tier`, `isPremium`, `aiCoachRemaining`, `featureLimits`.
2. **`<PremiumGate>`** component — wraps premium-only UI, shows lock + "Upgrade to Premium" CTA.
3. **`SubscriptionBanner`** — reword to show current tier; on Free, show "Upgrade to Premium – $4.99/mo".
4. **Pricing page** (new `/pricing`) — two-card comparison with checkout buttons.
5. **ParentDashboard**:
   - Show tier badge ("Free" / "Premium").
   - "Add Child" disabled with tooltip when free + has 1 child.
   - Gate "Recurring" and (if added) "Run Allowances" buttons.
6. **AICoach component** — show remaining sessions for free; block on limit with upgrade CTA.
7. **JarPercentageEditor** — read-only for free.
8. **Wishlist** — limit to 3 active items on free, with inline upgrade prompt.
9. **Transaction history** — filter to last 30 days for free; show "Upgrade for full history" footer.
10. **NotificationPrompt** — only render for premium.
11. **EditChildProfile** — hide password reset / email credentials buttons on free.

## Stripe

- Existing `create-checkout` already targets the $4.99 price; on success → `tier` becomes `premium` via `check-subscription`. No new product needed.
- Free tier = no Stripe customer required; subscribe button initiates checkout.

## Trial behavior

- New parents get the existing trial (treated as `premium` while active). After trial expires without subscribing, they downgrade to `free` automatically (not blocked — they lose features but app stays usable). Update `SubscriptionBanner` "Trial Expired" copy accordingly: no longer blocks the dashboard.

## Files

**New:** `supabase/migrations/<ts>_tiers.sql`, `src/components/PremiumGate.tsx`, `src/pages/Pricing.tsx`, `src/lib/tier-limits.ts`
**Edited:** `supabase/functions/{check-subscription,ai-coach,process-allowances,process-recurring-chores,send-push-notification,parent-reset-child-password,send-child-credentials}/index.ts`, `src/hooks/use-subscription.ts`, `src/components/SubscriptionBanner.tsx`, `src/components/AICoach.tsx`, `src/components/JarPercentageEditor.tsx`, `src/components/NotificationPrompt.tsx`, `src/components/EditChildProfile.tsx`, `src/pages/ParentDashboard.tsx`, `src/pages/AddChild.tsx`, `src/pages/ChildWishlist.tsx`, `src/pages/ParentChildDetail.tsx`, `src/App.tsx` (route)

## Open questions

1. Should expired trial users land on Free (keep using app, limited) or stay hard-blocked as today? Plan assumes **downgrade to Free**.
2. AI coach monthly reset: calendar month (1st of month) or 30-day rolling from first use? Plan assumes **calendar month**.
3. Existing parents with >1 child on Free — grandfather them in (no forced deletion) but block adding more? Plan assumes **yes**.
