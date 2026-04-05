alter table public.profiles
add column if not exists status_emoji text;

alter table public.profiles
add column if not exists status_text text;

alter table public.profiles
add column if not exists status_updated_at timestamptz;

comment on column public.profiles.status_emoji is
'Optional short emoji status for the current user profile.';

comment on column public.profiles.status_text is
'Optional short text status for the current user profile.';

comment on column public.profiles.status_updated_at is
'Last time the current user updated their profile status.';
