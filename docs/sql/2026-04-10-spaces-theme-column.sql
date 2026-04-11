alter table public.spaces
add column if not exists theme text;

alter table public.spaces
drop constraint if exists spaces_theme_check;

alter table public.spaces
add constraint spaces_theme_check
check (theme is null or theme in ('dark', 'light'));

comment on column public.spaces.theme is
'Optional persisted base theme for the space. Null defaults to the dark app shell.';
