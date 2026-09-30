# Soft-delete Users with a 30-day restore, then hard purge

Account deletion sets `deleted_at` instead of deleting the row. It revokes every session at once, and sign-in and session lookup reject deleted Users, so item and tag queries need no extra filter. If the User signs in with Google again within 30 days, `deleted_at` is cleared and their data comes back. After 30 days a scheduled job hard-deletes the row, and the existing cascades remove everything they saved. We wanted an undo for accidental deletion without giving up the privacy-first promise that deleted data really goes away.

## Considered Options

- **Hard delete right away**: simplest and the most private, but a mis-click loses everything with no recovery.
- **Soft delete, and a fresh account on re-signup**: needs `email` to be unique only among live Users (a partial index). The returning User gets an empty account while the old data sits hidden until purge, which is confusing and wasteful.
- **Soft delete, kept forever**: conflicts with privacy-first positioning and GDPR erasure requests.

## Consequences

- `email` stays plainly unique. A deleted User's email is never reused while the row exists.
- The purge job and the restore-on-sign-in hook have to be built before account deletion ships. Until then, deleted rows just stay.
