-- ---------------------------------------------------------------------------
-- Migration 005: server-side sync conflict log
-- ---------------------------------------------------------------------------
-- Stores a record of every conflict resolved during guard offline sync,
-- visible to society admins for audit purposes.
-- ---------------------------------------------------------------------------

create table if not exists sync_conflict_log (
  id             uuid primary key default gen_random_uuid(),
  society_id     uuid references societies(id) on delete set null,
  visitor_id     uuid,
  conflict_type  text not null,
  local_value    text,
  server_value   text,
  resolved_value text,
  resolved_at    timestamptz not null default now()
);

create index if not exists idx_sync_conflict_society
  on sync_conflict_log(society_id);
