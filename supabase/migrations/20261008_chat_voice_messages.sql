-- CREOVA AI chat voice messages.
-- Adds audio metadata to chat messages and permits m4a uploads.

alter table public.chat_messages
  add column if not exists audio_url text null,
  add column if not exists audio_duration_ms integer null;

alter table public.chat_messages
  drop constraint if exists chat_messages_audio_duration_check;

alter table public.chat_messages
  add constraint chat_messages_audio_duration_check
  check (
    audio_duration_ms is null
    or audio_duration_ms between 0 and 600000
  );

update storage.buckets
set allowed_mime_types = array[
  'image/png',
  'audio/mpeg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/m4a'
]
where id = 'generation-assets';

-- Voice files are private and stored under:
--   <user_id>/<conversation_id>/<timestamp>.m4a
-- The client may upload only inside its own user folder.
drop policy if exists "chat_voice_upload_own" on storage.objects;

create policy "chat_voice_upload_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'generation-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "chat_voice_read_own" on storage.objects;

create policy "chat_voice_read_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'generation-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "chat_voice_delete_own" on storage.objects;

create policy "chat_voice_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'generation-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);
