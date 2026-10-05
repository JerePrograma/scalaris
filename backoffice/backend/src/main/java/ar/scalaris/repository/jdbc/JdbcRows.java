package ar.scalaris.repository.jdbc;

import static ar.scalaris.mapper.JsonDocuments.parse;

import java.math.BigDecimal;
import java.sql.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** Shared JDBC row conversion; never owns transaction boundaries or business rules. */
@Component
public class JdbcRows {
  private final JdbcTemplate db;

  public JdbcRows(JdbcTemplate db) {
    this.db = db;
  }

  public List<Map<String, Object>> rows(String sql, Object... args) {
    return db.query(
        sql,
        (rs, n) -> {
          var row = new LinkedHashMap<String, Object>();
          var meta = rs.getMetaData();
          for (int i = 1; i <= meta.getColumnCount(); i++) {
            Object v = rs.getObject(i);
            String type = meta.getColumnTypeName(i);
            if (v != null && (type.equals("jsonb") || type.equals("json"))) v = parse(v.toString());
            else if (v instanceof BigDecimal d) v = d.toPlainString();
            else if (v instanceof Timestamp t) v = t.toInstant().toString();
            else if (v instanceof java.sql.Date d) v = d.toLocalDate().toString();
            row.put(meta.getColumnLabel(i), v);
          }
          return row;
        },
        args);
  }

  public Map<String, Object> one(String sql, Object... args) {
    var rows = rows(sql, args);
    if (rows.isEmpty()) throw new ar.scalaris.exception.MissingRecordException();
    return rows.getFirst();
  }

  public long insert(String sql, Object... args) {
    return db.queryForObject(sql, Long.class, args);
  }

  public int update(String sql, Object... args) {
    return db.update(sql, args);
  }

  public <T> T scalar(String sql, Class<T> type, Object... args) {
    return db.queryForObject(sql, type, args);
  }
}
