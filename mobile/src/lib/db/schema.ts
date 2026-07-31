// ---------------------------------------------------------------------------
// Local SQLite schema — CREATE TABLE IF NOT EXISTS statements
// ---------------------------------------------------------------------------
// Uses expo-sqlite v14 async API.
// All timestamps stored as ISO-8601 text strings (UTC).
// ---------------------------------------------------------------------------

/**
 * local_visitors: offline mirror of visitor_logs rows created by the guard.
 * id is empty until the row syncs to the server and receives a real UUID.
 */
export const CREATE_LOCAL_VISITORS = `
  create table if not exists local_visitors (
    id                text primary key,
    local_id          text unique not null,
    society_id        text not null,
    flat_id           text not null,
    visitor_name      text not null,
    visitor_phone     text,
    purpose           text not null,
    vehicle_number    text,
    status            text not null default 'pending',
    photo_local_path  text,
    photo_url         text,
    entry_time        text not null,
    exit_time         text,
    sync_status       text not null default 'pending',
    sync_error        text,
    created_at        text not null,
    updated_at        text not null
  );
`;

/**
 * sync_queue: operations waiting to be sent to the server.
 * payload is a JSON-encoded string of the operation arguments.
 */
export const CREATE_SYNC_QUEUE = `
  create table if not exists sync_queue (
    id            integer primary key autoincrement,
    entity_type   text not null,
    operation     text not null,
    payload       text not null,
    created_at    text not null,
    attempts      integer not null default 0,
    last_attempt  text,
    next_attempt  text,
    status        text not null default 'pending'
  );
`;

/**
 * sync_conflict_log: record of every resolved conflict, for admin visibility.
 */
export const CREATE_SYNC_CONFLICT_LOG = `
  create table if not exists sync_conflict_log (
    id                 integer primary key autoincrement,
    visitor_local_id   text,
    conflict_type      text not null,
    local_value        text,
    server_value       text,
    resolved_value     text,
    resolved_at        text not null
  );
`;

/** All schema statements in dependency order. */
export const SCHEMA_STATEMENTS: string[] = [
  CREATE_LOCAL_VISITORS,
  CREATE_SYNC_QUEUE,
  CREATE_SYNC_CONFLICT_LOG,
];
