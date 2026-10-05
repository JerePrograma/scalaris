package ar.scalaris.repository.jdbc;

import static ar.scalaris.mapper.JsonDocuments.encode;

import java.util.*;
import org.springframework.stereotype.Repository;

/** SQL only: participates in the caller's transaction through the shared JdbcTemplate. */
@Repository
public class WorkOrderRepository {
  private final JdbcRows rows;

  public WorkOrderRepository(JdbcRows rows) {
    this.rows = rows;
  }

  public Map<String, Object> find(long caseId) {
    return rows.one("SELECT * FROM work_orders WHERE case_id=?", caseId);
  }

  public Map<String, Object> deliveryData(long caseId) {
    return rows.one("SELECT data FROM work_orders WHERE case_id=?", caseId);
  }

  public Map<String, Object> lock(long caseId) {
    return rows.one("SELECT * FROM work_orders WHERE case_id=? FOR UPDATE", caseId);
  }

  public void edit(long caseId, Object data) {
    rows.update(
        "UPDATE work_orders SET data=?::jsonb,version=version+1 WHERE case_id=?",
        encode(data),
        caseId);
  }

  public void assignRevision(long caseId, long revisionId) {
    rows.update(
        "INSERT INTO work_orders(case_id,revision_id) VALUES(?,?) ON CONFLICT(case_id) DO UPDATE"
            + " SET revision_id=excluded.revision_id,version=work_orders.version+1",
        caseId,
        revisionId);
  }
}
