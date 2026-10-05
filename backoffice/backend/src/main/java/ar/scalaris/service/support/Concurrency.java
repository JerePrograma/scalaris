package ar.scalaris.service.support;

import static ar.scalaris.dto.request.RequestInput.*;
import static ar.scalaris.repository.jdbc.RowValues.number;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Map;

public final class Concurrency {
  private Concurrency() {}

  public static void checkVersion(Map<String, Object> row, JsonNode input) {
    if (number(row, "version") != version(input))
      throw conflict("Otro dispositivo modificó el registro. Recargá antes de guardar.");
  }
}
