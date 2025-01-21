# Database Setup

## Initial Database Configuration

Before starting the project, you need to set up the database schema in Supabase. Run the following SQL commands in your Supabase SQL editor:
``` sql
DROP TABLE IF EXISTS counts;

CREATE TABLE counts (
  id SERIAL PRIMARY KEY,
  value INTEGER
);

INSERT INTO counts (value) VALUES (0);

```
