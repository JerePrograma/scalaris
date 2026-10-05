package ar.scalaris.mapper;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/** JSON document encoding shared by JDBC and snapshots, independent of HTTP validation. */
public final class JsonDocuments {
  public static final ObjectMapper JSON = new ObjectMapper();

  private JsonDocuments() {}

  public static JsonNode parse(String source) {
    try {
      return JSON.readTree(source);
    } catch (java.io.IOException e) {
      throw new IllegalArgumentException("JSON inválido.", e);
    }
  }

  public static String encode(Object value) {
    try {
      return JSON.writeValueAsString(value);
    } catch (java.io.IOException e) {
      throw new IllegalStateException(e);
    }
  }
}
