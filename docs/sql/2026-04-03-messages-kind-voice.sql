alter table public.messages
drop constraint if exists messages_kind_check;

alter table public.messages
add constraint messages_kind_check
check (kind in ('text', 'attachment', 'voice'));

comment on column public.messages.kind is
'Message rendering type. Current app uses text, attachment, and voice.';
