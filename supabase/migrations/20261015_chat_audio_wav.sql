-- CREOVA AI chat: allow WAV voice replies in the generation-assets bucket.
-- voice-generate stores every reply as <user_id>/<generation_id>.wav (audio/wav);
-- without this type the storage server rejects the upload and no voice reply is created.
update storage.buckets
set allowed_mime_types = (
  select array_agg(distinct mime)
  from unnest(allowed_mime_types || array['audio/wav', 'audio/x-wav']) as mime
)
where id = 'generation-assets'
  and allowed_mime_types is not null;
