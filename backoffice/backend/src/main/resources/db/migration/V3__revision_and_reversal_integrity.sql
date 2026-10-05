-- Enforce same-case links in addition to the transactional API checks.
ALTER TABLE revisions ADD CONSTRAINT revisions_id_case_unique UNIQUE(id,case_id);
ALTER TABLE cases ADD CONSTRAINT accepted_revision_same_case FOREIGN KEY(accepted_revision_id,id) REFERENCES revisions(id,case_id);
ALTER TABLE work_orders ADD CONSTRAINT work_revision_same_case FOREIGN KEY(revision_id,case_id) REFERENCES revisions(id,case_id);
ALTER TABLE payments ADD CONSTRAINT payments_id_case_unique UNIQUE(id,case_id);
ALTER TABLE payments ADD CONSTRAINT reversal_same_case FOREIGN KEY(reverses_id,case_id) REFERENCES payments(id,case_id);
