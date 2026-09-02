-- Instagram handle/link for a professional, shown in their booking presentation and
-- editable by reception (Nico's request to let the front desk keep photo/bio/instagram
-- up to date without touching admin settings).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS instagram TEXT;
