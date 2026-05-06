-- Add theme_mode column to profiles to support 'light', 'dark', and 'black'
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS theme_mode TEXT DEFAULT 'light';

-- Migrate existing dark_mode data to theme_mode
UPDATE profiles 
SET theme_mode = CASE 
  WHEN dark_mode = true THEN 'dark' 
  ELSE 'light' 
END
WHERE theme_mode IS NULL OR theme_mode = 'light';
