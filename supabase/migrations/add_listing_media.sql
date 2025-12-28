-- Add per-listing video and photo support
-- Each listing can have its own video and image

-- Add listing_video_url column
ALTER TABLE listings ADD COLUMN IF NOT EXISTS listing_video_url TEXT;

-- Add listing_image_url column
ALTER TABLE listings ADD COLUMN IF NOT EXISTS listing_image_url TEXT;

-- Add comments
COMMENT ON COLUMN listings.listing_video_url IS 'URL to listing-specific video (30 seconds) stored in Supabase Storage';
COMMENT ON COLUMN listings.listing_image_url IS 'URL to listing-specific image stored in Supabase Storage';

-- Note: Videos and images stored in 'listing-videos' and 'listing-images' buckets
-- Fallback to profile video/image if listing-specific media not available
