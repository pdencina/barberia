-- Add tenant_id to invoices for multi-tenant isolation.
-- Without this column, every business could see every other business's invoices
-- (they are financial documents), and there was no way to scope the list.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id);

-- NOTE: existing invoice rows will have tenant_id = NULL and won't show in any
-- business's list. Assign them to the correct business, e.g.:
--   UPDATE invoices SET tenant_id = '<tenant-uuid>' WHERE tenant_id IS NULL;
