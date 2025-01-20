DROP TABLE IF EXISTS counts;

CREATE TABLE counts (
  id SERIAL PRIMARY KEY,
  value INTEGER
);

INSERT INTO counts (value) VALUES (0);

-- For storing a personal counter for each user.
-- user_id references the built-in auth.users table in Supabase (if you are storing user data there).
CREATE TABLE IF NOT EXISTS personal_counts (
  user_id uuid references auth.users (id) not null primary key,
  value integer default 0
);
