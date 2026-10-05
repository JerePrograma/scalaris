package ar.scalaris.dto.request;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * Strict boundary validation. Money travels as decimal strings. No arbitrary JSON fields are
 * persisted.
 */
public final class RequestInput {
  public static final ZoneId ZONE = ZoneId.of("America/Argentina/Buenos_Aires");
  public static final ObjectMapper JSON = new ObjectMapper();

  private RequestInput() {}

  public static ResponseStatusException bad(String message) {
    return ar.scalaris.exception.RequestErrors.bad(message);
  }

  public static ResponseStatusException conflict(String message) {
    return ar.scalaris.exception.RequestErrors.conflict(message);
  }

  public static void fields(JsonNode n, String... keys) {
    if (n == null || !n.isObject()) throw bad("Se esperaba un objeto.");
    var allowed = Set.of(keys);
    n.fieldNames()
        .forEachRemaining(
            k -> {
              if (!allowed.contains(k)) throw bad("Campo no admitido: " + k);
            });
  }

  public static String text(JsonNode n, String key, int max, boolean required) {
    JsonNode v = n.get(key);
    if (v == null || v.isNull()) {
      if (required) throw bad("Falta " + key);
      return "";
    }
    if (!v.isTextual()) throw bad(key + ": debe ser texto.");
    String s = v.asText().strip();
    if (s.length() > max || s.indexOf('\0') >= 0 || (required && s.isBlank()))
      throw bad(key + ": longitud inválida.");
    return s;
  }

  public static BigDecimal decimal(JsonNode n, String key, BigDecimal fallback, int scale) {
    if (!n.hasNonNull(key)) {
      if (fallback != null) return fallback;
      throw bad("Falta " + key);
    }
    if (!n.get(key).isTextual()) throw bad(key + ": debe enviarse como texto decimal.");
    String s = n.get(key).asText();
    if (!s.matches("\\d{1,12}(\\.\\d{1," + scale + "})?"))
      throw bad(key + ": usá un decimal positivo con punto y hasta " + scale + " decimales.");
    return new BigDecimal(s);
  }

  public static long id(JsonNode n, String key) {
    if (!n.path(key).isIntegralNumber()
        || !n.path(key).canConvertToLong()
        || n.path(key).asLong() < 1) throw bad(key + ": identificador inválido.");
    return n.get(key).asLong();
  }

  public static long version(JsonNode n) {
    if (!n.path("version").isIntegralNumber() || n.path("version").asLong() < 0)
      throw bad("Falta la versión del registro.");
    return n.get("version").asLong();
  }

  public static String choice(JsonNode n, String key, String... values) {
    String s = text(n, key, 80, true);
    if (!Set.of(values).contains(s)) throw bad(key + ": opción inválida.");
    return s;
  }

  public static LocalDate date(JsonNode n, String key, LocalDate fallback) {
    String s = text(n, key, 10, false);
    try {
      return s.isEmpty() ? Objects.requireNonNull(fallback) : LocalDate.parse(s);
    } catch (Exception e) {
      throw bad(key + ": fecha inválida.");
    }
  }

  public static JsonNode parse(String s) {
    try {
      return JSON.readTree(s);
    } catch (Exception e) {
      throw bad("JSON inválido.");
    }
  }

  public static String encode(Object o) {
    try {
      return JSON.writeValueAsString(o);
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  public static ObjectNode client(JsonNode n) {
    fields(n, "name", "phone", "email", "address", "notes", "version");
    var r = JSON.createObjectNode();
    for (String k : List.of("name", "phone", "email", "address", "notes"))
      r.put(k, text(n, k, k.equals("notes") ? 3000 : 300, k.equals("name")));
    String email = r.path("email").asText();
    if (!email.isBlank() && !email.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+"))
      throw bad("Correo inválido.");
    return r;
  }

  public static ObjectNode caseData(JsonNode n, String service) {
    fields(
        n,
        "title",
        "type",
        "model",
        "serial",
        "accessories",
        "fault",
        "condition",
        "diagnosis",
        "notes",
        "need",
        "scope",
        "requirements",
        "deliverables");
    var r = JSON.createObjectNode();
    r.put("title", text(n, "title", 300, true));
    var keys =
        service.equals("SOFTWARE")
            ? List.of("need", "scope", "requirements", "deliverables", "diagnosis", "notes")
            : List.of(
                "type",
                "model",
                "serial",
                "accessories",
                "fault",
                "condition",
                "diagnosis",
                "notes");
    for (String k : keys) r.put(k, text(n, k, k.equals("notes") ? 9000 : 3000, false));
    return r;
  }
}
