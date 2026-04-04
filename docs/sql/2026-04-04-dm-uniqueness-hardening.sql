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

drop table if exists pg_temp.dm_duplicate_review;

create temporary table dm_duplicate_review on commit drop as
with dm_message_stats as (
  select
    m.conversation_id,
    count(*) as message_count,
    max(m.created_at) as last_message_created_at
  from public.messages m
  group by m.conversation_id
),
ranked_dm_duplicates as (
  select
    c.id as conversation_id,
    c.space_id,
    c.dm_key,
    c.created_at,
    c.last_message_at,
    coalesce(ms.message_count, 0) as message_count,
    ms.last_message_created_at,
    row_number() over (
      partition by c.space_id, c.dm_key
      order by
        case when coalesce(ms.message_count, 0) > 0 then 0 else 1 end,
        coalesce(ms.last_message_created_at, c.last_message_at) desc nulls last,
        c.created_at asc,
        c.id asc
    ) as duplicate_rank,
    count(*) over (
      partition by c.space_id, c.dm_key
    ) as duplicate_count
  from public.conversations c
  left join dm_message_stats ms
    on ms.conversation_id = c.id
  where c.kind = 'dm'
    and c.dm_key is not null
)
select
  winner.space_id,
  winner.dm_key,
  winner.conversation_id as winner_conversation_id,
  winner.message_count as winner_message_count,
  winner.last_message_created_at as winner_last_message_created_at,
  loser.conversation_id as loser_conversation_id,
  loser.message_count as loser_message_count,
  loser.last_message_created_at as loser_last_message_created_at,
  loser.created_at as loser_created_at
from ranked_dm_duplicates winner
join ranked_dm_duplicates loser
  on loser.space_id is not distinct from winner.space_id
 and loser.dm_key = winner.dm_key
where winner.duplicate_rank = 1
  and winner.duplicate_count > 1
  and loser.duplicate_rank > 1;

-- Review winners and losers before any cleanup:
select *
from dm_duplicate_review
order by space_id, dm_key, loser_message_count desc, loser_created_at asc;

-- Safe cleanup strategy:
-- 1. For every row in dm_duplicate_review, keep winner_conversation_id.
-- 2. If loser_message_count = 0, the loser is an empty duplicate and may be
--    deleted after membership cleanup.
-- 3. If loser_message_count > 0, rehome dependent rows to the winner first.
-- 4. Re-run the review query until it returns zero rows before adding indexes.
--
-- Suggested transactional cleanup outline:
--
-- begin;
--
--   -- Rehome message history from losers into winners.
--   update public.messages m
--   set conversation_id = review.winner_conversation_id
--   from dm_duplicate_review review
--   where m.conversation_id = review.loser_conversation_id
--     and review.loser_message_count > 0;
--
--   -- Remove duplicate memberships already represented on the winner.
--   delete from public.conversation_members cm
--   using dm_duplicate_review review
--   where cm.conversation_id = review.loser_conversation_id
--     and exists (
--       select 1
--       from public.conversation_members winner_cm
--       where winner_cm.conversation_id = review.winner_conversation_id
--         and winner_cm.user_id = cm.user_id
--     );
--
--   -- Move remaining loser memberships onto the winner conversation.
--   update public.conversation_members cm
--   set conversation_id = review.winner_conversation_id
--   from dm_duplicate_review review
--   where cm.conversation_id = review.loser_conversation_id;
--
--   -- Delete loser conversation rows after dependents are rehomed.
--   delete from public.conversations c
--   using dm_duplicate_review review
--   where c.id = review.loser_conversation_id;
--
-- commit;

do $$
begin
  if exists (
    select 1
    from dm_duplicate_review
  ) then
    raise exception
      'Duplicate DM conversations still exist. Review and clean dm_duplicate_review before creating DM uniqueness indexes.';
  end if;
end $$;

create unique index if not exists conversations_dm_key_unique_legacy_idx
on public.conversations (dm_key)
where kind = 'dm' and dm_key is not null and space_id is null;

create unique index if not exists conversations_space_dm_key_unique_idx
on public.conversations (space_id, dm_key)
where kind = 'dm' and dm_key is not null and space_id is not null;

comment on index public.conversations_dm_key_unique_legacy_idx is
'Legacy DM-only uniqueness for rows that still have no space_id.';

comment on index public.conversations_space_dm_key_unique_idx is
'Enforces exactly one DM conversation per unordered user pair inside a space.';
