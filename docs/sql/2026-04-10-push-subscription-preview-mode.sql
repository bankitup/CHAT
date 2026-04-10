alter table public.push_subscriptions
add column if not exists preview_mode text not null default 'show';

update public.push_subscriptions
set preview_mode = 'show'
where preview_mode is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'push_subscriptions_preview_mode_check'
  ) then
    alter table public.push_subscriptions
    add constraint push_subscriptions_preview_mode_check
    check (preview_mode in ('show', 'mask', 'reveal_after_open'));
  end if;
end $$;

comment on column public.push_subscriptions.preview_mode is
'Inbox preview privacy mode mirrored onto this browser/device subscription so push payloads can follow the same privacy policy.';

notify pgrst, 'reload schema';
