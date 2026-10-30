-- Anonymous aggregate protection only. Recipient data stays in the browser.
CREATE TABLE temilo_qloo_quota (
  id TEXT PRIMARY KEY CHECK (id = 'shared'),
  day TEXT NOT NULL,
  spent INTEGER NOT NULL CHECK (spent >= 0),
  recent JSONB NOT NULL DEFAULT '[]'::jsonb,
  leases JSONB NOT NULL DEFAULT '[]'::jsonb
);
INSERT INTO temilo_qloo_quota (id, day, spent)
VALUES ('shared', to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD'), 0);
