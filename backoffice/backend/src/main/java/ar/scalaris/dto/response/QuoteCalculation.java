package ar.scalaris.dto.response;

import com.fasterxml.jackson.databind.node.ObjectNode;
import java.math.BigDecimal;

/** Immutable public result; revisions retain their own independent snapshot. */
public record QuoteCalculation(
    ObjectNode snapshot,
    BigDecimal subtotal,
    BigDecimal discount,
    BigDecimal adjustment,
    BigDecimal total) {
  public QuoteCalculation {
    snapshot = snapshot.deepCopy();
  }

  @Override
  public ObjectNode snapshot() {
    return snapshot.deepCopy();
  }
}
