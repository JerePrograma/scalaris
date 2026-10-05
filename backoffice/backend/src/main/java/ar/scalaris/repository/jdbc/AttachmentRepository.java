package ar.scalaris.repository.jdbc;

import java.util.*;
import org.springframework.stereotype.Repository;

/** SQL only: participates in the caller's transaction through the shared JdbcTemplate. */
@Repository
public class AttachmentRepository {
  private final JdbcRows rows;

  public AttachmentRepository(JdbcRows rows) {
    this.rows = rows;
  }

  public int count(long caseId) {
    return rows.scalar("SELECT count(*) FROM attachments WHERE case_id=?", Integer.class, caseId);
  }

  public Map<String, Object> find(long id) {
    return rows.one("SELECT * FROM attachments WHERE id=?", id);
  }

  public long insert(
      long caseId, UUID storageName, String originalName, String mime, int size, String sha256) {
    return rows.insert(
        "INSERT INTO attachments(case_id,storage_name,original_name,mime,size,sha256)"
            + " VALUES(?,?,?,?,?,?) RETURNING id",
        caseId,
        storageName,
        originalName,
        mime,
        size,
        sha256);
  }
}
