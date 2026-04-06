create extension if not exists pgcrypto;

create table if not exists public.message_assets (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  created_by uuid not null,
  kind text not null
    check (kind in ('image', 'file', 'audio', 'voice-note')),
  source text not null
    check (source in ('supabase-storage', 'external-url')),
  storage_bucket text,
  storage_object_path text,
  external_url text,
  mime_type text,
  file_name text,
  size_bytes bigint,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint message_assets_storage_locator_check check (
    (source = 'supabase-storage' and storage_object_path is not null and external_url is null)
    or (source = 'external-url' and external_url is not null and storage_object_path is null)
  )
);

alter table public.message_assets
  add column if not exists conversation_id uuid,
  add column if not exists created_by uuid,
  add column if not exists kind text,
  add column if not exists source text,
  add column if not exists storage_bucket text,
  add column if not exists storage_object_path text,
  add column if not exists external_url text,
  add column if not exists mime_type text,
  add column if not exists file_name text,
  add column if not exists size_bytes bigint,
  add column if not exists duration_ms integer,
  add column if not exists created_at timestamptz default timezone('utc'::text, now());

alter table public.message_assets
  alter column id set default gen_random_uuid(),
  alter column created_at set default timezone('utc'::text, now());

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.message_assets'::regclass
      and conname = 'message_assets_conversation_id_fkey'
  ) then
    alter table public.message_assets
      add constraint message_assets_conversation_id_fkey
      foreign key (conversation_id)
      references public.conversations(id)
      on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.message_assets'::regclass
      and conname = 'message_assets_kind_check'
  ) then
    alter table public.message_assets
      add constraint message_assets_kind_check
      check (kind in ('image', 'file', 'audio', 'voice-note'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.message_assets'::regclass
      and conname = 'message_assets_source_check'
  ) then
    alter table public.message_assets
      add constraint message_assets_source_check
      check (source in ('supabase-storage', 'external-url'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.message_assets'::regclass
      and conname = 'message_assets_duration_ms_check'
  ) then
    alter table public.message_assets
      add constraint message_assets_duration_ms_check
      check (duration_ms is null or duration_ms >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.message_assets'::regclass
      and conname = 'message_assets_storage_locator_check'
  ) then
    alter table public.message_assets
      add constraint message_assets_storage_locator_check
      check (
        (source = 'supabase-storage' and storage_object_path is not null and external_url is null)
        or (source = 'external-url' and external_url is not null and storage_object_path is null)
      );
  end if;
end
$$;

create index if not exists message_assets_conversation_created_at_idx
  on public.message_assets (conversation_id, created_at desc);

create index if not exists message_assets_kind_idx
  on public.message_assets (kind);

create table if not exists public.message_asset_links (
  message_id uuid not null references public.messages(id) on delete cascade,
  asset_id uuid not null references public.message_assets(id) on delete cascade,
  ordinal integer not null default 0
    check (ordinal >= 0),
  render_as_primary boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  primary key (message_id, asset_id)
);

alter table public.message_asset_links
  add column if not exists message_id uuid,
  add column if not exists asset_id uuid,
  add column if not exists ordinal integer default 0,
  add column if not exists render_as_primary boolean default true,
  add column if not exists created_at timestamptz default timezone('utc'::text, now());

alter table public.message_asset_links
  alter column ordinal set default 0,
  alter column render_as_primary set default true,
  alter column created_at set default timezone('utc'::text, now());

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.message_asset_links'::regclass
      and conname = 'message_asset_links_pkey'
  ) then
    alter table public.message_asset_links
      add constraint message_asset_links_pkey
      primary key (message_id, asset_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.message_asset_links'::regclass
      and conname = 'message_asset_links_message_id_fkey'
  ) then
    alter table public.message_asset_links
      add constraint message_asset_links_message_id_fkey
      foreign key (message_id)
      references public.messages(id)
      on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.message_asset_links'::regclass
      and conname = 'message_asset_links_asset_id_fkey'
  ) then
    alter table public.message_asset_links
      add constraint message_asset_links_asset_id_fkey
      foreign key (asset_id)
      references public.message_assets(id)
      on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.message_asset_links'::regclass
      and conname = 'message_asset_links_ordinal_check'
  ) then
    alter table public.message_asset_links
      add constraint message_asset_links_ordinal_check
      check (ordinal >= 0);
  end if;
end
$$;

create unique index if not exists message_asset_links_message_ordinal_idx
  on public.message_asset_links (message_id, ordinal);

create index if not exists message_asset_links_asset_id_idx
  on public.message_asset_links (asset_id);

create index if not exists message_asset_links_message_created_at_idx
  on public.message_asset_links (message_id, created_at asc);

grant select, insert, update, delete on public.message_assets to authenticated;
grant select, insert, update, delete on public.message_asset_links to authenticated;
grant select, insert, update, delete on public.message_assets to service_role;
grant select, insert, update, delete on public.message_asset_links to service_role;

alter table public.message_assets enable row level security;
alter table public.message_asset_links enable row level security;

drop policy if exists message_assets_select_active_members on public.message_assets;
create policy message_assets_select_active_members
on public.message_assets
for select
to authenticated
using (
  exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = message_assets.conversation_id
      and cm.user_id = auth.uid()
      and cm.state = 'active'
  )
);

drop policy if exists message_assets_insert_active_members on public.message_assets;
create policy message_assets_insert_active_members
on public.message_assets
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = message_assets.conversation_id
      and cm.user_id = auth.uid()
      and cm.state = 'active'
  )
);

drop policy if exists message_assets_delete_creator on public.message_assets;
create policy message_assets_delete_creator
on public.message_assets
for delete
to authenticated
using (
  created_by = auth.uid()
  and exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = message_assets.conversation_id
      and cm.user_id = auth.uid()
      and cm.state = 'active'
  )
);

drop policy if exists message_asset_links_select_active_members on public.message_asset_links;
create policy message_asset_links_select_active_members
on public.message_asset_links
for select
to authenticated
using (
  exists (
    select 1
    from public.messages m
    join public.conversation_members cm
      on cm.conversation_id = m.conversation_id
    where m.id = message_asset_links.message_id
      and cm.user_id = auth.uid()
      and cm.state = 'active'
  )
);

drop policy if exists message_asset_links_insert_sender on public.message_asset_links;
create policy message_asset_links_insert_sender
on public.message_asset_links
for insert
to authenticated
with check (
  exists (
    select 1
    from public.messages m
    join public.conversation_members cm
      on cm.conversation_id = m.conversation_id
    join public.message_assets a
      on a.id = message_asset_links.asset_id
    where m.id = message_asset_links.message_id
      and m.sender_id = auth.uid()
      and cm.user_id = auth.uid()
      and cm.state = 'active'
      and a.created_by = auth.uid()
      and a.conversation_id = m.conversation_id
  )
);

comment on table public.message_assets is
'Committed binary asset metadata for messages. Voice notes, files, images, and audio belong here rather than in message rows.';

comment on table public.message_asset_links is
'Links committed message assets to durable message rows without coupling thread history to upload-job runtime state.';

comment on column public.message_assets.kind is
'Committed media kind. Voice notes map to messages.kind = ''voice'' while other asset kinds usually map to messages.kind = ''attachment''.';

comment on column public.message_assets.duration_ms is
'Optional committed duration for audio and voice-note assets. Inbox and activity must not load the binary blob to derive this.';

comment on column public.message_asset_links.render_as_primary is
'Marks the asset that should be treated as the primary thread render target when a message has multiple linked assets.';

notify pgrst, 'reload schema';
