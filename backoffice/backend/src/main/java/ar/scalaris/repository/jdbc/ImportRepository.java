package ar.scalaris.repository.jdbc;

import java.util.*;
import org.springframework.stereotype.Repository;

/** SQL only: participates in the caller's transaction through the shared JdbcTemplate. */
@Repository
public class ImportRepository {
  private final JdbcRows rows;

  public ImportRepository(JdbcRows rows) {
    this.rows = rows;
  }

  public List<Map<String, Object>> duplicates(UUID externalId, String hash) {
    return rows.rows(
        "SELECT i.case_id,c.number AS case_number FROM imports i JOIN cases c ON c.id=i.case_id"
            + " WHERE i.external_id=? OR i.sha256=?",
        externalId,
        hash);
  }

  public void lockFingerprint(String hash) {
    rows.scalar("SELECT pg_advisory_xact_lock(hashtext(?)) IS NULL", Boolean.class, hash);
  }

  public boolean exists(UUID externalId, String hash) {
    return !rows.rows(
            "SELECT case_id FROM imports WHERE external_id=? OR sha256=?", externalId, hash)
        .isEmpty();
  }

  public void create(UUID externalId, String hash, long caseId) {
    rows.update(
        "INSERT INTO imports(external_id,sha256,case_id) VALUES(?,?,?)", externalId, hash, caseId);
  }
}
