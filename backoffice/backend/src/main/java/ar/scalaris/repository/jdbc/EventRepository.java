package ar.scalaris.repository.jdbc;

import static ar.scalaris.mapper.JsonDocuments.encode;

import java.util.*;
import org.springframework.stereotype.Repository;

/** SQL only: participates in the caller's transaction through the shared JdbcTemplate. */
@Repository
public class EventRepository {
  private final JdbcRows rows;

  public EventRepository(JdbcRows rows) {
    this.rows = rows;
  }

  public void event(Long caseId, String entity, long entityId, String type, Object data) {
    rows.update(
        "INSERT INTO events(case_id,entity,entity_id,type,data) VALUES(?,?,?,?,?::jsonb)",
        caseId,
        entity,
        entityId,
        type,
        encode(data));
  }
}
