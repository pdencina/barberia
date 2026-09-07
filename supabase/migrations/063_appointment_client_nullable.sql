-- Allow appointments without a client (walk-in / held slot).
--
-- Reception frequently books a time slot first and assigns the client later. But
-- appointments.client_id was NOT NULL (migration 001), so creating a cita without
-- selecting a client failed the insert — the appointment was never saved even though
-- the UI seemed to proceed. Making it nullable lets reception hold a slot with just a
-- barber + time.
ALTER TABLE appointments ALTER COLUMN client_id DROP NOT NULL;
