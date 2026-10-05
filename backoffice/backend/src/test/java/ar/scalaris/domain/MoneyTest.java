package ar.scalaris.domain;

import static org.assertj.core.api.Assertions.*;

import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class MoneyTest {
  private static BigDecimal decimal(String value) {
    return new BigDecimal(value);
  }

  @Test
  void pureCalculationsPreserveArsRoundingOrderAndExplicitAdjustment() {
    var line =
        Money.line(
            decimal("1.005"), decimal("100.00"), new Money.Discount("PERCENT", decimal("10")));
    var total =
        Money.calculate(List.of(line), new Money.Discount("PERCENT", decimal("5")), null, "");
    assertThat(line.gross()).isEqualByComparingTo("100.50");
    assertThat(line.discount()).isEqualByComparingTo("10.05");
    assertThat(total.discount()).isEqualByComparingTo("14.57");
    assertThat(total.total()).isEqualByComparingTo("85.93");
    assertThat(Money.suggestedDeposit(total.total(), decimal("10"))).isEqualByComparingTo("8.59");
    var adjusted =
        Money.calculate(
            List.of(line),
            new Money.Discount("AMOUNT", decimal("0.45")),
            decimal("100"),
            "Acuerdo manual");
    assertThat(adjusted.adjustment()).isEqualByComparingTo("10.00");
    assertThat(adjusted.total()).isEqualByComparingTo("100.00");
  }

  @Test
  void domainRejectsInvalidDiscountsNegativeAmountsAndUnexplainedManualTotals() {
    assertThatThrownBy(() -> new Money.Discount("NONE", decimal("1")))
        .isInstanceOf(BusinessRuleException.class);
    assertThatThrownBy(() -> new Money.Discount("PERCENT", decimal("100.01")))
        .hasMessageContaining("100");
    assertThatThrownBy(
            () -> Money.line(decimal("0"), decimal("1"), new Money.Discount("NONE", decimal("0"))))
        .hasMessageContaining("Cantidad");
    var line = Money.line(decimal("1"), decimal("10"), new Money.Discount("NONE", decimal("0")));
    assertThatThrownBy(
            () ->
                Money.calculate(
                    List.of(line), new Money.Discount("AMOUNT", decimal("11")), null, ""))
        .hasMessageContaining("supera");
    assertThatThrownBy(
            () ->
                Money.calculate(
                    List.of(line), new Money.Discount("NONE", decimal("0")), decimal("9"), ""))
        .hasMessageContaining("motivo");
    assertThatThrownBy(() -> Money.suggestedDeposit(decimal("10"), decimal("100.01")))
        .hasMessageContaining("Seña");
    assertThatThrownBy(() -> new Money.Line(decimal("10"), decimal("1"), decimal("10")))
        .hasMessageContaining("incoherentes");
    assertThat(QuoteValidity.suggestedExpiry(java.time.LocalDate.parse("2026-10-02")))
        .isEqualTo(java.time.LocalDate.parse("2026-10-09"));
  }
}
