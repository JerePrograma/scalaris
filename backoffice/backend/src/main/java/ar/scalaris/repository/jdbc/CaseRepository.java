package ar.scalaris.repository.jdbc;

import static ar.scalaris.mapper.JsonDocuments.encode;

import java.util.*;
import org.springframework.stereotype.Repository;

/** SQL only: participates in the caller's transaction through the shared JdbcTemplate. */
@Repository
public class CaseRepository {
  private final JdbcRows rows;

  public CaseRepository(JdbcRows rows) {
    this.rows = rows;
  }

  public Map<String, Object> caseRow(long id) {
    return rows.one("SELECT * FROM cases WHERE id=?", id);
  }

  public Map<String, Object> lockCase(long id) {
    return rows.one("SELECT * FROM cases WHERE id=? FOR UPDATE", id);
  }

  public long create(long clientId, String service, Object data) {
    return rows.insert(
        "INSERT INTO cases(client_id,service,data) VALUES(?,?,?::jsonb) RETURNING id",
        clientId,
        service,
        encode(data));
  }

  public void edit(long id, long clientId, Object data) {
    rows.update(
        "UPDATE cases SET client_id=?,data=?::jsonb,version=version+1,updated_at=now() WHERE id=?",
        clientId,
        encode(data),
        id);
  }

  public void transition(long id, String status) {
    rows.update(
        "UPDATE cases SET status=?,version=version+1,updated_at=now() WHERE id=?", status, id);
  }

  public void allocateQuoteNumber(long id) {
    rows.update(
        "UPDATE cases SET quote_number=nextval('quote_number'),version=version+1 WHERE id=?", id);
  }

  public void quoted(long id) {
    rows.update(
        "UPDATE cases SET status='QUOTED',version=version+1,updated_at=now() WHERE id=?", id);
  }

  public void accept(long id, long revisionId, String status) {
    rows.update(
        "UPDATE cases SET status=?,accepted_revision_id=?,version=version+1,updated_at=now() WHERE"
            + " id=?",
        status,
        revisionId,
        id);
  }
}
