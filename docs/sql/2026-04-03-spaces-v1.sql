create table if not exists public.spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.spaces is
'Top-level container for a project, team, or client context. Contains direct messages and group chats.';

comment on column public.spaces.created_by is
'Owning auth user for the space. Ownership is an access/admin concept, not a DM decryption power.';

create table if not exists public.space_members (
  space_id uuid not null references public.spaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (space_id, user_id)
);

comment on table public.space_members is
'Membership and coarse role boundary for entering a space. Roles do not grant encrypted DM plaintext access.';

create unique index if not exists space_members_single_owner_idx
on public.space_members (space_id)
where role = 'owner';

alter table public.conversations
add column if not exists space_id uuid references public.spaces (id) on delete cascade;

comment on column public.conversations.space_id is
'Parent space for the conversation. DMs and groups are scoped to one space and must not be global.';

drop index if exists public.conversations_dm_key_unique_idx;

create unique index if not exists conversations_dm_key_unique_legacy_idx
on public.conversations (dm_key)
where kind = 'dm' and dm_key is not null and space_id is null;

create unique index if not exists conversations_space_dm_key_unique_idx
on public.conversations (space_id, dm_key)
where kind = 'dm' and dm_key is not null and space_id is not null;

comment on index public.conversations_space_dm_key_unique_idx is
'Makes direct-message uniqueness space-scoped once conversations are assigned to explicit spaces.';

-- Backfill note:
-- `public.conversations.space_id` is intentionally added nullable first so the
-- app can backfill legacy conversations into concrete spaces before tightening
-- this column to not null during the runtime active-space rollout.
