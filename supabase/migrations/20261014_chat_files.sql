-- CREOVA AI chat: files that users attach to a message (zip, pdf, documents, audio, video, ...).
--
-- Run this BEFORE deploying the updated `chat-history` and the new `chat-file`
-- Edge Functions.
--
-- 1. A private bucket `chat-files`. Every user can only touch the folder named after
--    their own user id: <user_id>/<conversation_id>/<message_id>.<ext>.
--    The per-file limit below is 500 MB, but Supabase also has a project wide limit
--    (Settings -> Storage). On the Free plan that limit is 50 MB at most; on Pro it can
--    be raised, and then the bucket limit applies.
-- 2. chat_messages gets the columns that describe the attached file, and the
--    columns where `chat-file` caches the Gemini Files API reference (48 hours).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-files', 'chat-files', false, 524288000, null)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = null;

drop policy if exists "chat_files_upload_own" on storage.objects;
create policy "chat_files_upload_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'chat-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "chat_files_read_own" on storage.objects;
create policy "chat_files_read_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'chat-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "chat_files_delete_own" on storage.objects;
create policy "chat_files_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'chat-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

alter table public.chat_messages
  add column if not exists file_path text,
  add column if not exists file_name text,
  add column if not exists file_size bigint,
  add column if not exists file_mime text,
  add column if not exists file_ai_uri text,
  add column if not exists file_ai_name text,
  add column if not exists file_ai_mime text,
  add column if not exists file_ai_expires timestamptz;
