package ar.scalaris.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Objects;

/** ARS expert: line rounding, discounts, total adjustment and suggested deposit. */
public final class Money {
  private static final BigDecimal HUNDRED = new BigDecimal("100");
  private static final BigDecimal MAX_TOTAL = new BigDecimal("999999999999.99");

  private Money() {}

  public record Discount(String type, BigDecimal value) {
    public Discount {
      if (!List.of("NONE", "AMOUNT", "PERCENT").contains(type)
          || value == null
          || value.signum() < 0) throw new BusinessRuleException("Descuento inválido.");
      if (type.equals("NONE") && value.signum() != 0)
        throw new BusinessRuleException("Sin descuento debe tener valor cero.");
      if (type.equals("PERCENT") && value.compareTo(HUNDRED) > 0)
        throw new BusinessRuleException("Porcentaje mayor a 100.");
    }

    public BigDecimal amount(BigDecimal base) {
      BigDecimal result =
          round(type.equals("PERCENT") ? base.multiply(value).divide(HUNDRED) : value);
      if (result.compareTo(base) > 0)
        throw new BusinessRuleException("El descuento supera el importe.");
      return result;
    }
  }

  public record Line(BigDecimal gross, BigDecimal discount, BigDecimal total) {
    public Line {
      Objects.requireNonNull(gross);
      Objects.requireNonNull(discount);
      Objects.requireNonNull(total);
      if (gross.signum() < 0
          || discount.signum() < 0
          || discount.compareTo(gross) > 0
          || total.compareTo(gross.subtract(discount)) != 0)
        throw new BusinessRuleException("Importes de concepto incoherentes.");
    }
  }

  public record Totals(
      BigDecimal subtotal, BigDecimal discount, BigDecimal adjustment, BigDecimal total) {}

  public static BigDecimal round(BigDecimal amount) {
    return amount.setScale(2, RoundingMode.HALF_UP);
  }

  public static Line line(BigDecimal quantity, BigDecimal unitPrice, Discount discount) {
    if (quantity.signum() <= 0
        || quantity.compareTo(new BigDecimal("100000")) > 0
        || unitPrice.signum() < 0
        || unitPrice.compareTo(new BigDecimal("1000000000")) > 0)
      throw new BusinessRuleException("Cantidad o precio fuera de rango.");
    BigDecimal gross = round(quantity.multiply(round(unitPrice)));
    BigDecimal reduction = discount.amount(gross);
    return new Line(gross, reduction, gross.subtract(reduction));
  }

  public static Totals calculate(
      List<Line> lines, Discount global, BigDecimal manualTotal, String reason) {
    if (lines.isEmpty() || lines.size() > 80)
      throw new BusinessRuleException("Incluí entre 1 y 80 conceptos.");
    BigDecimal subtotal = round(BigDecimal.ZERO), lineDiscount = subtotal;
    for (Line line : lines) {
      subtotal = subtotal.add(line.gross());
      lineDiscount = lineDiscount.add(line.discount());
    }
    BigDecimal allDiscount = lineDiscount.add(global.amount(subtotal.subtract(lineDiscount)));
    BigDecimal base = subtotal.subtract(allDiscount), total = base;
    if (manualTotal != null) {
      if (manualTotal.signum() < 0) throw new BusinessRuleException("Importes fuera de rango.");
      if (reason.isBlank()) throw new BusinessRuleException("Indicá el motivo del total manual.");
      total = round(manualTotal);
    }
    if (subtotal.compareTo(MAX_TOTAL) > 0 || total.compareTo(MAX_TOTAL) > 0)
      throw new BusinessRuleException("Importes fuera de rango.");
    return new Totals(subtotal, allDiscount, total.subtract(base), total);
  }

  public static BigDecimal suggestedDeposit(BigDecimal total, BigDecimal percent) {
    if (percent.signum() < 0 || percent.compareTo(HUNDRED) > 0)
      throw new BusinessRuleException("Seña fuera de rango.");
    return round(total.multiply(percent).divide(HUNDRED));
  }
}
