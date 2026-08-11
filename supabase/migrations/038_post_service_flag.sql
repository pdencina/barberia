-- Track if post-service email was sent
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS post_service_sent BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
