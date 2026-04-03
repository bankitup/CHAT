alter table public.profiles
add column if not exists preferred_language text not null default 'en';

alter table public.profiles
drop constraint if exists profiles_preferred_language_check;

alter table public.profiles
add constraint profiles_preferred_language_check
check (preferred_language in ('en', 'ru'));

comment on column public.profiles.preferred_language is
'User-selected app language preference for the current product shell.';
