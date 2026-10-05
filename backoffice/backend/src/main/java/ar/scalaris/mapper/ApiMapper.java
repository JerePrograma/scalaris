package ar.scalaris.mapper;

import ar.scalaris.domain.Account;
import ar.scalaris.domain.Money;
import ar.scalaris.dto.response.Balance;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.*;

/** Explicit HTTP projections prevent new SQL columns from extending the JSON contract. */
public final class ApiMapper {
  private ApiMapper() {}

  public static Balance balance(Account account) {
    return new Balance(
        Money.round(account.total()).toPlainString(),
        Money.round(account.paid()).toPlainString(),
        Money.round(account.balance()).toPlainString(),
        account.status());
  }

  private static Map<String, Object> fields(Map<String, Object> row, String... names) {
    var view = new LinkedHashMap<String, Object>();
    for (String name : names) {
      if (row.containsKey(name)) {
        Object value = row.get(name);
        view.put(name, value instanceof JsonNode json ? json.deepCopy() : value);
      }
    }
    return Collections.unmodifiableMap(view);
  }

  public static Map<String, Object> client(Map<String, Object> row) {
    return fields(row, "id", "version", "data", "created_at");
  }

  public static Map<String, Object> catalog(Map<String, Object> row) {
    return fields(
        row,
        "id",
        "seed_key",
        "version",
        "description",
        "kind",
        "unit",
        "price",
        "active",
        "source");
  }

  public static Map<String, Object> caseView(Map<String, Object> row) {
    return fields(
        row,
        "id",
        "number",
        "client_id",
        "version",
        "service",
        "status",
        "data",
        "quote_number",
        "accepted_revision_id",
        "created_at",
        "updated_at",
        "client");
  }

  public static Map<String, Object> revision(Map<String, Object> row) {
    return fields(
        row,
        "id",
        "case_id",
        "revision",
        "status",
        "version",
        "snapshot",
        "subtotal",
        "discount",
        "adjustment",
        "total",
        "created_at",
        "sent_at",
        "accepted_at",
        "acceptance");
  }

  public static Map<String, Object> work(Map<String, Object> row) {
    return fields(row, "case_id", "revision_id", "version", "data");
  }

  public static Map<String, Object> payment(Map<String, Object> row) {
    return fields(
        row,
        "id",
        "case_id",
        "amount",
        "paid_date",
        "method",
        "reference",
        "note",
        "operation_key",
        "reverses_id",
        "created_at");
  }

  public static Map<String, Object> attachment(Map<String, Object> row) {
    return fields(
        row,
        "id",
        "case_id",
        "storage_name",
        "original_name",
        "mime",
        "size",
        "sha256",
        "created_at");
  }

  public static Map<String, Object> event(Map<String, Object> row) {
    return fields(
        row, "id", "case_id", "entity", "entity_id", "type", "data", "origin", "occurred_at");
  }
}
