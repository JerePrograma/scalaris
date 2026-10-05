package ar.scalaris.service;

import static ar.scalaris.dto.request.RequestInput.*;

import ar.scalaris.domain.Money;
import ar.scalaris.domain.QuoteValidity;
import ar.scalaris.dto.response.QuoteCalculation;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.*;
import java.math.*;
import java.time.LocalDate;
import java.util.ArrayList;

/**
 * ARS: round each line gross, then its discount; global discount follows line discounts; adjustment
 * is last.
 */
public final class QuoteCalculator {
  private QuoteCalculator() {}

  private static Money.Discount discount(JsonNode n) {
    return new Money.Discount(
        choice(n, "discountType", "NONE", "AMOUNT", "PERCENT"),
        decimal(n, "discountValue", BigDecimal.ZERO, 2));
  }

  public static QuoteCalculation calculate(JsonNode n) {
    fields(
        n,
        "items",
        "discountType",
        "discountValue",
        "manualTotal",
        "adjustmentReason",
        "conditions",
        "leadTime",
        "issueDate",
        "expiryDate",
        "depositPercent",
        "version");
    if (!n.path("items").isArray() || n.get("items").size() < 1 || n.get("items").size() > 80)
      throw bad("Incluí entre 1 y 80 conceptos.");
    var out = JSON.createObjectNode();
    var items = out.putArray("items");
    var lines = new ArrayList<Money.Line>();
    for (var item : n.get("items")) {
      fields(
          item,
          "kind",
          "description",
          "quantity",
          "unit",
          "unitPrice",
          "discountType",
          "discountValue");
      var copy = items.addObject();
      copy.put("kind", choice(item, "kind", "LABOR", "PART", "OTHER"));
      copy.put("description", text(item, "description", 1000, true));
      copy.put("unit", text(item, "unit", 40, true));
      BigDecimal qty = decimal(item, "quantity", null, 3),
          price = Money.round(decimal(item, "unitPrice", null, 2));
      var line = Money.line(qty, price, discount(item));
      lines.add(line);
      BigDecimal gross = line.gross(), d = line.discount();
      copy.put("quantity", qty.toPlainString());
      copy.put("unitPrice", price.toPlainString());
      copy.put("discountType", item.path("discountType").asText());
      copy.put("discountValue", decimal(item, "discountValue", BigDecimal.ZERO, 2).toPlainString());
      copy.put("gross", gross.toPlainString());
      copy.put("discount", d.toPlainString());
      copy.put("total", line.total().toPlainString());
    }
    String reason = text(n, "adjustmentReason", 1000, false);
    BigDecimal manualTotal = null;
    if (n.hasNonNull("manualTotal") && !n.get("manualTotal").asText().isBlank()) {
      manualTotal = Money.round(decimal(n, "manualTotal", null, 2));
      out.put("manualTotal", manualTotal.toPlainString());
    }
    var result = Money.calculate(lines, discount(n), manualTotal, reason);
    LocalDate issue = date(n, "issueDate", LocalDate.now(ZONE));
    var validity =
        new QuoteValidity(issue, date(n, "expiryDate", QuoteValidity.suggestedExpiry(issue)));
    BigDecimal deposit = decimal(n, "depositPercent", new BigDecimal("10"), 2);
    var suggestedDeposit = Money.suggestedDeposit(result.total(), deposit);
    out.put("issueDate", issue.toString());
    out.put("expiryDate", validity.expiryDate().toString());
    out.put("conditions", text(n, "conditions", 6000, false));
    out.put("leadTime", text(n, "leadTime", 500, true));
    out.put("discountType", n.path("discountType").asText());
    out.put("discountValue", decimal(n, "discountValue", BigDecimal.ZERO, 2).toPlainString());
    out.put("adjustmentReason", reason);
    out.put("depositPercent", deposit.toPlainString());
    out.put("suggestedDeposit", suggestedDeposit.toPlainString());
    out.put("currency", "ARS");
    return new QuoteCalculation(
        out, result.subtotal(), result.discount(), result.adjustment(), result.total());
  }
}
