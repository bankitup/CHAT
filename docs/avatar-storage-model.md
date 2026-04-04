# Avatar Storage Model

Purpose:

- define the MVP storage and access rules for user avatars
- keep avatar behavior separate from message attachments and DM E2EE
- make bucket usage and profile reference rules explicit

## Current storage design

Avatar files live in the Supabase Storage bucket named `avatars` by default.

The current app code resolves the bucket name from:

- browser upload path: `NEXT_PUBLIC_SUPABASE_AVATARS_BUCKET`
- server path: `SUPABASE_AVATARS_BUCKET`
- fallback: `avatars`

New avatar uploads are stored under a user-scoped object path:

- `<user_id>/<random>-<sanitized-file-name>`

Examples:

- `9d0.../4c2...-avatar.png`
- `9d0.../7f8...-profile-photo.webp`

## Profile reference model

Avatar references are stored in:

- `public.profiles.avatar_path`

Current rule:

- new writes store the storage object path, not a baked public URL
- older absolute avatar URLs are still tolerated for backward compatibility

At read time, the server resolves `avatar_path` into a renderable URL for UI use.

## Read behavior

Avatar rendering is treated as profile identity data, not secret content.

MVP read rule:

- avatars may be readable to authenticated app users who can see profile identity surfaces

The app currently tries:

1. signed URL generation for stored object paths
2. server-side signed URL fallback through privileged service access if auth-scoped signed URL generation is blocked at runtime

This keeps the rendering path compatible with a private bucket while still letting authenticated users see other users' avatars in chat surfaces.

## Write / replace / remove behavior

Users may only manage their own profile avatar reference and their own managed avatar objects.

Current app behavior:

- upload/replace is allowed only for the authenticated user updating their own profile
- new uploads are always written under that user’s own object-path prefix
- remove clears only that user’s `profiles.avatar_path`
- cleanup deletes only storage-backed avatar objects under that same user prefix

Important boundary:

- the app does not delete arbitrary object paths from `profiles.avatar_path`
- cleanup only runs for managed paths matching `<user_id>/...`

## Recommended storage policy shape

For MVP, keep the bucket rules simple:

- authenticated users may read avatar objects
- authenticated users may upload only into their own prefix
- authenticated users may update/delete only objects in their own prefix

See:

- [2026-04-03-avatars-storage-policies.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-03-avatars-storage-policies.sql)

## What avatars are not

Avatars are not:

- encrypted DM content
- message attachments
- a general media library

Space admins and operators do not gain special DM plaintext access through avatar storage. Avatar storage is a profile/media concern only.
