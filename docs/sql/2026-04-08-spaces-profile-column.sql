alter table public.spaces
add column if not exists profile text;

alter table public.spaces
drop constraint if exists spaces_profile_check;

alter table public.spaces
add constraint spaces_profile_check
check (profile is null or profile in ('messenger_full', 'keepcozy_ops'));

comment on column public.spaces.profile is
'Optional persisted shell profile for the space. Null keeps temporary runtime fallback rules active.';
