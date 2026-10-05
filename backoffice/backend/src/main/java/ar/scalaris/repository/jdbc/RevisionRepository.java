package ar.scalaris.repository.jdbc;

import static ar.scalaris.mapper.JsonDocuments.encode;

import java.math.BigDecimal;
import java.util.*;
import org.springframework.stereotype.Repository;

/** SQL only: participates in the caller's transaction through the shared JdbcTemplate. */
@Repository
public class RevisionRepository {
  private final JdbcRows rows;

  public RevisionRepository(JdbcRows rows) {
    this.rows = rows;
  }

  public Map<String, Object> find(long id) {
    return rows.one("SELECT * FROM revisions WHERE id=?", id);
  }

  public Map<String, Object> lock(long id, long caseId) {
    return rows.one("SELECT * FROM revisions WHERE id=? AND case_id=? FOR UPDATE", id, caseId);
  }

  public int nextRevision(long caseId) {
    return rows.scalar(
        "SELECT COALESCE(max(revision),0)+1 FROM revisions WHERE case_id=?", Integer.class, caseId);
  }

  public long create(
      long caseId,
      int revision,
      Object snapshot,
      BigDecimal subtotal,
      BigDecimal discount,
      BigDecimal adjustment,
      BigDecimal total) {
    return rows.insert(
        "INSERT INTO revisions(case_id,revision,snapshot,subtotal,discount,adjustment,total)"
            + " VALUES(?,?,?::jsonb,?,?,?,?) RETURNING id",
        caseId,
        revision,
        encode(snapshot),
        subtotal,
        discount,
        adjustment,
        total);
  }

  public void edit(
      long id,
      Object snapshot,
      BigDecimal subtotal,
      BigDecimal discount,
      BigDecimal adjustment,
      BigDecimal total) {
    rows.update(
        "UPDATE revisions SET"
            + " snapshot=?::jsonb,subtotal=?,discount=?,adjustment=?,total=?,version=version+1"
            + " WHERE id=?",
        encode(snapshot),
        subtotal,
        discount,
        adjustment,
        total,
        id);
  }

  public void send(long id) {
    rows.update(
        "UPDATE revisions SET status='SENT',sent_at=now(),version=version+1 WHERE id=?", id);
  }

  public void accept(long id, java.time.Instant accepted, Object acceptance) {
    rows.update(
        "UPDATE revisions SET status='ACCEPTED',accepted_at=?,acceptance=?::jsonb,version=version+1"
            + " WHERE id=?",
        java.sql.Timestamp.from(accepted),
        encode(acceptance),
        id);
  }
}
