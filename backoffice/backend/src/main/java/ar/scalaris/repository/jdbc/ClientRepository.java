package ar.scalaris.repository.jdbc;

import static ar.scalaris.mapper.JsonDocuments.encode;

import java.util.*;
import org.springframework.stereotype.Repository;

/** SQL only: participates in the caller's transaction through the shared JdbcTemplate. */
@Repository
public class ClientRepository {
  private final JdbcRows rows;

  public ClientRepository(JdbcRows rows) {
    this.rows = rows;
  }

  public Map<String, Object> find(Object id) {
    return rows.one("SELECT * FROM clients WHERE id=?", id);
  }

  public void requireExists(long id) {
    rows.one("SELECT id FROM clients WHERE id=?", id);
  }

  public Map<String, Object> lock(long id) {
    return rows.one("SELECT * FROM clients WHERE id=? FOR UPDATE", id);
  }

  public long create(Object data) {
    return rows.insert("INSERT INTO clients(data) VALUES(?::jsonb) RETURNING id", encode(data));
  }

  public void edit(long id, Object data) {
    rows.update("UPDATE clients SET data=?::jsonb,version=version+1 WHERE id=?", encode(data), id);
  }
}
