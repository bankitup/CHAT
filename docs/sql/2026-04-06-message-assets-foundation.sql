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

create unique index if not exists message_asset_links_message_ordinal_idx
  on public.message_asset_links (message_id, ordinal);

create index if not exists message_asset_links_asset_id_idx
  on public.message_asset_links (asset_id);

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
