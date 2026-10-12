-- Supabase unified logs use ClickHouse SQL, separate from Postgres diagnostics.
-- Grain: one row per log event. Window: last 24 hours at investigation time.
SELECT timestamp, event_message
FROM logs
WHERE source = 'postgres_logs'
  AND (event_message ILIKE '%flashcard%'
    OR event_message ILIKE '%invalid input syntax%'
    OR event_message ILIKE '%row-level security%')
ORDER BY timestamp DESC
LIMIT 20;

SELECT timestamp, event_message, log_attributes
FROM logs
WHERE source = 'postgres_logs'
  AND event_message ILIKE '%row-level security%flashcard_progress%'
ORDER BY timestamp DESC
LIMIT 1;
