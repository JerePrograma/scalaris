package ar.scalaris.repository.jdbc;

import java.math.BigDecimal;
import java.util.*;
import org.springframework.stereotype.Repository;

/** SQL only: participates in the caller's transaction through the shared JdbcTemplate. */
@Repository
public class CatalogRepository {
  private final JdbcRows rows;

  public CatalogRepository(JdbcRows rows) {
    this.rows = rows;
  }

  public Map<String, Object> find(long id) {
    return rows.one("SELECT * FROM catalog WHERE id=?", id);
  }

  public Map<String, Object> lock(long id) {
    return rows.one("SELECT * FROM catalog WHERE id=? FOR UPDATE", id);
  }

  public long create(
      String description, String kind, String unit, BigDecimal price, boolean active) {
    return rows.insert(
        "INSERT INTO catalog(description,kind,unit,price,active) VALUES(?,?,?,?,?) RETURNING id",
        description,
        kind,
        unit,
        price,
        active);
  }

  public void edit(
      long id, String description, String kind, String unit, BigDecimal price, boolean active) {
    rows.update(
        "UPDATE catalog SET description=?,kind=?,unit=?,price=?,active=?,version=version+1 WHERE"
            + " id=?",
        description,
        kind,
        unit,
        price,
        active,
        id);
  }
}
