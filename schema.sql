DROP TABLE IF EXISTS counts;

CREATE TABLE counts (
  id SERIAL PRIMARY KEY,
  value INTEGER
);

INSERT INTO counts (value) VALUES (0);