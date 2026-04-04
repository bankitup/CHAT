alter table public.conversations
add column if not exists dm_key text;

comment on column public.conversations.dm_key is
'Canonical unordered pair key for DM uniqueness. Format: sorted(user_a,user_b) joined by a colon. Groups must leave dm_key null.';

with dm_pairs as (
  select
    c.id as conversation_id,
    c.space_id,
    string_agg(cm.user_id, ':' order by cm.user_id) filter (where cm.state = 'active') as computed_dm_key,
    count(*) filter (where cm.state = 'active') as active_member_count
  from public.conversations c
  join public.conversation_members cm
    on cm.conversation_id = c.id
  where c.kind = 'dm'
  group by c.id, c.space_id
)
update public.conversations c
set dm_key = dm_pairs.computed_dm_key
from dm_pairs
where c.id = dm_pairs.conversation_id
  and c.kind = 'dm'
  and dm_pairs.active_member_count = 2
  and dm_pairs.computed_dm_key is not null
  and (c.dm_key is null or c.dm_key <> dm_pairs.computed_dm_key);

-- Preflight duplicate review:
-- This CTE shows every duplicate DM group, the proposed canonical winner, and
-- the loser rows that must be rehomed before any unique index can be enforced.
--
-- Winner policy:
-- 1. most recent `last_message_at`
-- 2. then earliest `created_at`
-- 3. then lexicographically smallest conversation id
--
-- Review this result before any destructive cleanup.
with ranked_dm_duplicates as (
  select
    c.id as conversation_id,
    c.space_id,
    c.dm_key,
    c.created_at,
    c.last_message_at,
    row_number() over (
      partition by c.space_id, c.dm_key
      order by c.last_message_at desc nulls last, c.created_at asc, c.id asc
    ) as duplicate_rank,
    count(*) over (
      partition by c.space_id, c.dm_key
    ) as duplicate_count
  from public.conversations c
  where c.kind = 'dm'
    and c.dm_key is not null
)
select
  winner.space_id,
  winner.dm_key,
  winner.conversation_id as winner_conversation_id,
  loser.conversation_id as loser_conversation_id,
  loser.created_at as loser_created_at,
  loser.last_message_at as loser_last_message_at
from ranked_dm_duplicates winner
join ranked_dm_duplicates loser
  on loser.space_id is not distinct from winner.space_id
 and loser.dm_key = winner.dm_key
where winner.duplicate_rank = 1
  and winner.duplicate_count > 1
  and loser.duplicate_rank > 1
order by winner.space_id, winner.dm_key, loser.duplicate_rank;

-- Safe cleanup strategy (manual, inside a transaction after reviewing winners):
-- 1. Rehome dependent rows from each loser conversation into its winner:
--    - public.messages
--    - public.conversation_members
--    - any other conversation-owned rows
-- 2. Deduplicate winner conversation_members per user before deleting losers.
-- 3. Delete loser conversation rows only after all dependents are rehomed.
-- 4. Re-run the duplicate review query and confirm it returns zero rows.

do $$
begin
  if exists (
    select 1
    from public.conversations c
    where c.kind = 'dm'
      and c.dm_key is not null
    group by c.space_id, c.dm_key
    having count(*) > 1
  ) then
    raise exception
      'Duplicate space-scoped DM conversations still exist. Review docs/sql/2026-04-04-dm-uniqueness-hardening.sql and clean losers before creating the unique index.';
  end if;
end $$;

create unique index if not exists conversations_dm_key_unique_legacy_idx
on public.conversations (dm_key)
where kind = 'dm' and dm_key is not null and space_id is null;

create unique index if not exists conversations_space_dm_key_unique_idx
on public.conversations (space_id, dm_key)
where kind = 'dm' and dm_key is not null and space_id is not null;

comment on index public.conversations_space_dm_key_unique_idx is
'Enforces exactly one DM conversation per unordered user pair inside a space.';
