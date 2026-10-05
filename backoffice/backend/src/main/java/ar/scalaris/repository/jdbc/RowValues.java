package ar.scalaris.repository.jdbc;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Map;

public final class RowValues {
  private RowValues() {}

  public static long number(Map<String, Object> row, String key) {
    return ((Number) row.get(key)).longValue();
  }

  public static JsonNode data(Map<String, Object> row) {
    return (JsonNode) row.get("data");
  }
}
