# Second Chances

A private "last chances" app for a graduating class: sign in, secretly pick the
classmates you have a crush on, and if it's mutual, you both get matched. Built
for the Stanford GSB MBA Class of 2025.

## Stack

- React 19 + TypeScript + Vite
- Firebase — Auth (Google), Firestore, Storage, Cloud Functions
- Hosted on Vercel

## Develop

```bash
npm install
npm run dev      # start the dev server
npm run build    # type-check + production build
npm run lint     # eslint
```

Cloud Functions live in `functions/` (their own `package.json`).

## Layout

```
src/components   UI (dashboard, profile, admin, shared)
src/contexts     auth context
src/hooks        admin data hooks
src/utils        helpers
src/config        Firebase init
functions/src    Cloud Functions (matching engine, analytics)
firestore.rules  Firestore security rules
```

## Notes

- The Firebase web config in `src/config/firebase.ts` is public by design;
  access is enforced by `firestore.rules`.
- Private class data (`src/data/extra/`, `scripts/data/`) is gitignored and
  never published.
