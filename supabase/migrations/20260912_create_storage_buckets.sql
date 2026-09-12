-- ============================================================
-- CREOVA
-- Migration: 20260912_create_storage_buckets
-- Purpose:
--   Create the two Storage buckets the AI generation edge
--   functions already upload to, but which were never created
--   anywhere in SQL:
--
--     - "generation-assets"  <- image-generate, voice-generate,
--                                music-generate
--     - "videos"             <- video-generate
--
--   Without this migration, every image/voice/music/video
--   generation fails at the final "save the result" step with
--   a Storage "Bucket not found" error, even though the AI
--   provider call itself succeeded.
--
-- Security:
--   - Both buckets are PRIVATE (public = false). Nothing is
--     served over a public URL.
--   - All uploads happen exclusively via the edge functions'
--     service_role admin client, which bypasses Storage RLS by
--     default — no client-facing INSERT/UPDATE/DELETE policies
--     are created here on purpose.
--   - The mobile app never reads these buckets directly either;
--     it is only ever given a short-lived signed URL
--     (createSignedUrl), which the edge functions already
--     generate after upload. Signed URLs are authorized at
--     generation time by the service_role caller, so no
--     additional SELECT policy is required for authenticated
--     users.
-- ============================================================


-- ============================================================
-- BUCKETS
-- ============================================================

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values
  (
    'generation-assets',
    'generation-assets',
    false,
    52428800, -- 50 MB, comfortably covers PNG images and MP3 audio
    array[
      'image/png',
      'audio/mpeg'
    ]
  ),
  (
    'videos',
    'videos',
    false,
    209715200, -- 200 MB, comfortably covers generated MP4 clips
    array[
      'video/mp4'
    ]
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;


-- ============================================================
-- COMMENTS
-- ============================================================

comment on table storage.buckets is
  'Includes CREOVA-managed buckets: generation-assets (images/audio) and videos (video clips), both private and written only by trusted edge functions.';
