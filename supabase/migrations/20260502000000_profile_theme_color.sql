-- Add per-user theme preferences to profiles
-- Each family member can have their own app color and dark/light mode

ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS theme_color TEXT DEFAULT NULL;

ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS dark_mode BOOLEAN DEFAULT NULL;
