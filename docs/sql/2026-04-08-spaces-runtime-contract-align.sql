-- Compatibility align for older environments where public.spaces exists but
-- predates the current runtime contract from 2026-04-03-spaces-v1.sql.
--
-- Current runtime expectation:
-- - required base columns: id, name, created_by, created_at, updated_at
-- - optional persisted profile column: profile
--
-- Apply docs/sql/2026-04-08-spaces-profile-column.sql separately when the
-- environment should persist space shell profiles instead of relying on the
-- runtime fallback.

alter table public.spaces
add column if not exists updated_at timestamptz default timezone('utc', now());

update public.spaces
set updated_at = coalesce(updated_at, created_at, timezone('utc', now()))
where updated_at is null;

alter table public.spaces
alter column updated_at set default timezone('utc', now());

alter table public.spaces
alter column updated_at set not null;

comment on column public.spaces.updated_at is
'Last runtime-managed update timestamp for the space row. Required by create-space provisioning and later space runtime alignment.';
