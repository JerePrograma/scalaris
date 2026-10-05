CREATE SEQUENCE case_number;
CREATE SEQUENCE quote_number;
CREATE TABLE clients (
 id BIGSERIAL PRIMARY KEY, version BIGINT NOT NULL DEFAULT 0,
 data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE catalog (
 id BIGSERIAL PRIMARY KEY, seed_key TEXT UNIQUE, version BIGINT NOT NULL DEFAULT 0,
 description TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('LABOR','PART','OTHER')),
 unit TEXT NOT NULL, price NUMERIC(16,2) NOT NULL CHECK(price>=0), active BOOLEAN NOT NULL DEFAULT true,
 source TEXT NOT NULL DEFAULT 'Carga manual'
);
CREATE TABLE cases (
 id BIGSERIAL PRIMARY KEY, number BIGINT NOT NULL UNIQUE DEFAULT nextval('case_number'),
 client_id BIGINT NOT NULL REFERENCES clients(id), version BIGINT NOT NULL DEFAULT 0,
 service TEXT NOT NULL CHECK(service IN ('EQUIPMENT','PARTS','SOFTWARE')),
 status TEXT NOT NULL DEFAULT 'INQUIRY' CHECK(status IN ('INQUIRY','DIAGNOSIS','QUOTED','ACCEPTED','WORKING','READY','DELIVERED','REJECTED','CANCELLED')),
 data JSONB NOT NULL, quote_number BIGINT UNIQUE, accepted_revision_id BIGINT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE revisions (
 id BIGSERIAL PRIMARY KEY, case_id BIGINT NOT NULL REFERENCES cases(id), revision INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','SENT','ACCEPTED')),
 version BIGINT NOT NULL DEFAULT 0, snapshot JSONB NOT NULL, subtotal NUMERIC(16,2) NOT NULL,
 discount NUMERIC(16,2) NOT NULL, adjustment NUMERIC(16,2) NOT NULL, total NUMERIC(16,2) NOT NULL CHECK(total>=0),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), sent_at TIMESTAMPTZ,
 accepted_at TIMESTAMPTZ, acceptance JSONB,
 UNIQUE(case_id,revision)
);
ALTER TABLE cases ADD CONSTRAINT accepted_revision_fk FOREIGN KEY(accepted_revision_id) REFERENCES revisions(id);
CREATE TABLE work_orders (
 case_id BIGINT PRIMARY KEY REFERENCES cases(id), revision_id BIGINT NOT NULL REFERENCES revisions(id),
 version BIGINT NOT NULL DEFAULT 0, data JSONB NOT NULL DEFAULT '{"tasks":[],"progress":"","actualHours":"0","reception":"","delivery":""}'
);
CREATE TABLE payments (
 id BIGSERIAL PRIMARY KEY, case_id BIGINT NOT NULL REFERENCES cases(id), amount NUMERIC(16,2) NOT NULL CHECK(amount>0),
 paid_date DATE NOT NULL, method TEXT NOT NULL, reference TEXT NOT NULL, note TEXT NOT NULL,
 operation_key UUID NOT NULL UNIQUE, reverses_id BIGINT UNIQUE REFERENCES payments(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE attachments (
 id BIGSERIAL PRIMARY KEY, case_id BIGINT NOT NULL REFERENCES cases(id), storage_name UUID NOT NULL UNIQUE,
 original_name TEXT NOT NULL, mime TEXT NOT NULL, size BIGINT NOT NULL CHECK(size BETWEEN 1 AND 8388608),
 sha256 TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE events (
 id BIGSERIAL PRIMARY KEY, case_id BIGINT REFERENCES cases(id), entity TEXT NOT NULL, entity_id BIGINT NOT NULL,
 type TEXT NOT NULL, data JSONB NOT NULL, origin TEXT NOT NULL DEFAULT 'operación local anónima', occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE imports (
 external_id UUID PRIMARY KEY, sha256 TEXT NOT NULL UNIQUE, case_id BIGINT NOT NULL REFERENCES cases(id), imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX cases_client ON cases(client_id);
CREATE INDEX cases_updated ON cases(updated_at);
CREATE INDEX events_case ON events(case_id,id);
CREATE INDEX payments_case ON payments(case_id);
CREATE FUNCTION immutable_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Registro histórico inmutable'; END $$;
CREATE TRIGGER events_immutable BEFORE UPDATE OR DELETE ON events FOR EACH ROW EXECUTE FUNCTION immutable_history();
CREATE TRIGGER payments_immutable BEFORE UPDATE OR DELETE ON payments FOR EACH ROW EXECUTE FUNCTION immutable_history();
CREATE FUNCTION freeze_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'No se eliminan revisiones'; END IF;
 IF OLD.status <> 'DRAFT' AND (NEW.snapshot IS DISTINCT FROM OLD.snapshot OR NEW.subtotal<>OLD.subtotal OR NEW.discount<>OLD.discount OR NEW.adjustment<>OLD.adjustment OR NEW.total<>OLD.total OR NEW.case_id<>OLD.case_id OR NEW.revision<>OLD.revision) THEN RAISE EXCEPTION 'Revisión congelada'; END IF;
 IF OLD.status='ACCEPTED' THEN RAISE EXCEPTION 'Aceptación inmutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER revisions_frozen BEFORE UPDATE OR DELETE ON revisions FOR EACH ROW EXECUTE FUNCTION freeze_revision();
