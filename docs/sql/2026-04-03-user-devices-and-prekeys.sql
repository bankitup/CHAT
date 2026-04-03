create table if not exists public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  device_id integer not null,
  registration_id integer not null,
  identity_key_public text not null,
  signed_prekey_id integer not null,
  signed_prekey_public text not null,
  signed_prekey_signature text not null,
  created_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz null,
  retired_at timestamptz null,
  unique (user_id, device_id)
);

comment on table public.user_devices is
'Public per-device key material for DM end-to-end encryption. Private keys must remain client-side only.';

comment on column public.user_devices.device_id is
'Stable per-user device slot used by the DM E2EE protocol layer.';

comment on column public.user_devices.registration_id is
'Signal-style registration id used during session setup. Public only.';

comment on column public.user_devices.identity_key_public is
'Device identity public key. Never store the private half server-side.';

comment on column public.user_devices.signed_prekey_public is
'Current signed prekey public value for asynchronous session establishment.';

comment on column public.user_devices.signed_prekey_signature is
'Signature over the signed prekey, verifiable against the device identity public key.';

create index if not exists user_devices_user_id_active_idx
on public.user_devices (user_id)
where retired_at is null;

alter table public.user_devices enable row level security;

drop policy if exists user_devices_select_public_bundles on public.user_devices;
create policy user_devices_select_public_bundles
on public.user_devices
for select
to authenticated
using (retired_at is null);

drop policy if exists user_devices_insert_own on public.user_devices;
create policy user_devices_insert_own
on public.user_devices
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists user_devices_update_own on public.user_devices;
create policy user_devices_update_own
on public.user_devices
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create table if not exists public.device_one_time_prekeys (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.user_devices(id) on delete cascade,
  prekey_id integer not null,
  public_key text not null,
  claimed_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (device_id, prekey_id)
);

comment on table public.device_one_time_prekeys is
'Public one-time prekeys available for DM E2EE session establishment. Private halves stay client-side only.';

comment on column public.device_one_time_prekeys.claimed_at is
'When non-null, this one-time prekey has been consumed by an initial encrypted message.';

create index if not exists device_one_time_prekeys_available_idx
on public.device_one_time_prekeys (device_id, created_at)
where claimed_at is null;

alter table public.device_one_time_prekeys enable row level security;

drop policy if exists device_one_time_prekeys_select_public on public.device_one_time_prekeys;
create policy device_one_time_prekeys_select_public
on public.device_one_time_prekeys
for select
to authenticated
using (
  claimed_at is null
  and exists (
    select 1
    from public.user_devices d
    where d.id = device_id
      and d.retired_at is null
  )
);

drop policy if exists device_one_time_prekeys_insert_own on public.device_one_time_prekeys;
create policy device_one_time_prekeys_insert_own
on public.device_one_time_prekeys
for insert
to authenticated
with check (
  exists (
    select 1
    from public.user_devices d
    where d.id = device_id
      and d.user_id = auth.uid()
  )
);

drop policy if exists device_one_time_prekeys_update_own on public.device_one_time_prekeys;
create policy device_one_time_prekeys_update_own
on public.device_one_time_prekeys
for update
to authenticated
using (
  exists (
    select 1
    from public.user_devices d
    where d.id = device_id
      and d.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.user_devices d
    where d.id = device_id
      and d.user_id = auth.uid()
  )
);

drop policy if exists device_one_time_prekeys_delete_own on public.device_one_time_prekeys;
create policy device_one_time_prekeys_delete_own
on public.device_one_time_prekeys
for delete
to authenticated
using (
  exists (
    select 1
    from public.user_devices d
    where d.id = device_id
      and d.user_id = auth.uid()
  )
);
