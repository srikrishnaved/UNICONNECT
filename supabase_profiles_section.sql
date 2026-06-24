-- Run once in Supabase SQL Editor.
-- Adds the section column to profiles (null for non-F&A students).
alter table profiles add column if not exists section text;
