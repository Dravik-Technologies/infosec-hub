ALTER TABLE users ALTER COLUMN role SET DEFAULT 'Hub Viewer';

UPDATE users
SET role = CASE role
  WHEN 'Corporate Admin' THEN 'Hub Admin'
  WHEN 'Access Admin' THEN 'Hub Admin'
  WHEN 'Site Admin' THEN 'Hub User'
  WHEN 'Viewer' THEN 'Hub Viewer'
  ELSE role
END;
