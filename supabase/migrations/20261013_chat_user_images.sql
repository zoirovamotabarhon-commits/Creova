-- CREOVA AI chat: keep the photos users send in the chat.
--
-- Run this BEFORE deploying the updated `chat-history` Edge Function: the
-- function now reads and writes chat_messages.image_path.
--
-- 1. chat_messages.image_path: storage path (inside the private
--    `generation-assets` bucket) of a photo the user attached to a message.
--    Photos are stored at <user_id>/<conversation_id>/<message_id>.jpg.
-- 2. Allow JPEG uploads in that bucket (keeping every existing type).

alter table public.chat_messages
  add column if not exists image_path text;

update storage.buckets
set allowed_mime_types = (
  select array_agg(distinct mime)
  from unnest(
    allowed_mime_types || array['image/jpeg']
  ) as mime
)
where id = 'generation-assets'
  and allowed_mime_types is not null;
