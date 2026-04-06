alter table public.conversations
add column if not exists join_policy text;

update public.conversations
set join_policy = 'closed'
where join_policy is null;

alter table public.conversations
alter column join_policy set default 'closed';

alter table public.conversations
alter column join_policy set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'conversations_join_policy_check'
  ) then
    alter table public.conversations
    add constraint conversations_join_policy_check
    check (join_policy in ('open', 'closed'));
  end if;
end
$$;
