package ar.scalaris.domain;

import java.math.BigDecimal;
import java.util.Objects;

/** Immutable expert for an accepted amount and its effective payments (including reversals). */
public final class Account {
  private final BigDecimal total;
  private final BigDecimal paid;
  private final boolean accepted;

  public Account(BigDecimal total, BigDecimal paid, boolean accepted) {
    this.total = Objects.requireNonNull(total);
    this.paid = Objects.requireNonNull(paid);
    this.accepted = accepted;
  }

  public BigDecimal total() {
    return total;
  }

  public BigDecimal paid() {
    return paid;
  }

  public BigDecimal balance() {
    return total.subtract(paid);
  }

  public String status() {
    return paid.signum() == 0 ? "UNPAID" : paid.compareTo(total) >= 0 ? "PAID" : "PARTIAL";
  }

  public void requireAcceptedQuote() {
    if (!accepted) throw new BusinessRuleException("Registrá primero una revisión aceptada.");
  }

  public void requirePayment(BigDecimal amount) {
    requireAcceptedQuote();
    if (amount.signum() <= 0 || amount.compareTo(balance()) > 0)
      throw new BusinessRuleException("El importe debe ser positivo y no superar el saldo.");
  }

  public void requireReplacementTotal(BigDecimal replacement) {
    if (replacement.compareTo(paid) < 0)
      throw new BusinessRuleException(
          "El nuevo total es menor que los pagos vigentes. Anulá los pagos correspondientes"
              + " primero.");
  }
}
