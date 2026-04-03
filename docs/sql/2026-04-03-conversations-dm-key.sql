alter table public.conversations
add column if not exists dm_key text;

comment on column public.conversations.dm_key is
'Sorted user-pair key for direct-message uniqueness. Used to reuse existing DMs and prevent duplicates.';

with dm_pairs as (
  select
    c.id as conversation_id,
    string_agg(cm.user_id, ':' order by cm.user_id) filter (where cm.state = 'active') as dm_key,
    count(*) filter (where cm.state = 'active') as active_member_count
  from public.conversations c
  join public.conversation_members cm
    on cm.conversation_id = c.id
  where c.kind = 'dm'
  group by c.id
),
unique_dm_pairs as (
  select dm_key
  from dm_pairs
  where dm_key is not null
    and active_member_count = 2
  group by dm_key
  having count(*) = 1
)
update public.conversations c
set dm_key = dm_pairs.dm_key
from dm_pairs
join unique_dm_pairs
  on unique_dm_pairs.dm_key = dm_pairs.dm_key
where c.id = dm_pairs.conversation_id
  and c.dm_key is null;

create unique index if not exists conversations_dm_key_unique_idx
on public.conversations (dm_key)
where kind = 'dm' and dm_key is not null;
