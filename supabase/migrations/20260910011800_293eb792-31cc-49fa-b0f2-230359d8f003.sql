-- NOTIFICATION SYSTEM UPGRADE — soft-delete for independent removal.
alter table public.ustad_notifications
  add column if not exists deleted_at timestamptz;

create index if not exists ustad_notifications_deleted_idx
  on public.ustad_notifications (guest_id, deleted_at)
  where deleted_at is null;