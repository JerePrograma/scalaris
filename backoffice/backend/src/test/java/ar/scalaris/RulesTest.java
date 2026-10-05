package ar.scalaris;

import static ar.scalaris.dto.request.RequestInput.*;
import static org.assertj.core.api.Assertions.*;

import ar.scalaris.config.LocalDatabase;
import ar.scalaris.controller.*;
import ar.scalaris.domain.*;
import ar.scalaris.repository.jdbc.*;
import ar.scalaris.service.*;
import ar.scalaris.storage.AttachmentValidator;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class RulesTest {
  @Test
  void remoteDatabaseIsRejectedBeforeConnection() {
    assertThatThrownBy(
            () -> LocalDatabase.validateUrl("jdbc:postgresql://192.168.1.10:5432/scalaris"))
        .hasMessageContaining("loopback");
    assertThatThrownBy(
            () ->
                LocalDatabase.validateUrl(
                    "jdbc:postgresql://localhost:5432/scalaris?socketFactory=custom"))
        .hasMessageContaining("loopback");
    assertThatThrownBy(() -> LocalDatabase.validateUrl("jdbc:postgresql://127.0.0.1:5432/scalaris"))
        .hasMessageContaining("Molineros");
    assertThatThrownBy(() -> LocalDatabase.validateUrl("jdbc:postgresql://localhost/scalaris"))
        .hasMessageContaining("puerto explícito");
    LocalDatabase.validateUrl("jdbc:postgresql://127.0.0.1:5433/scalaris");
    LocalDatabase.validateUrl("jdbc:postgresql://127.0.0.1:55432/scalaris_test_disposable");
  }

  static com.fasterxml.jackson.databind.node.ObjectNode quote() {
    return (com.fasterxml.jackson.databind.node.ObjectNode)
        parse(
            """
            {"items":[{"kind":"LABOR","description":"Servicio","quantity":"1.005","unit":"hora","unitPrice":"100.00","discountType":"PERCENT","discountValue":"10"}],"discountType":"PERCENT","discountValue":"5","conditions":"Condiciones","leadTime":"3 días","issueDate":"2026-10-02","depositPercent":"10"}
            """);
  }

  @Test
  void orderOfOperationsAndHalfUp() {
    var q = QuoteCalculator.calculate(quote());
    assertThat(q.subtotal()).isEqualByComparingTo("100.50");
    assertThat(q.discount()).isEqualByComparingTo("14.57");
    assertThat(q.total()).isEqualByComparingTo("85.93");
    assertThat(q.snapshot().path("suggestedDeposit").asText()).isEqualTo("8.59");
    assertThat(Money.round(new BigDecimal("1.005"))).isEqualByComparingTo("1.01");
  }

  @Test
  void amountDiscountAndManualAdjustmentPreserveLine() {
    var n = quote();
    n.put("discountType", "AMOUNT")
        .put("discountValue", "0.45")
        .put("manualTotal", "100")
        .put("adjustmentReason", "Acuerdo manual");
    var r = QuoteCalculator.calculate(n);
    assertThat(r.total()).isEqualByComparingTo("100");
    assertThat(r.adjustment()).isEqualByComparingTo("10.00");
    assertThat(r.snapshot().path("items").get(0).path("unitPrice").asText()).isEqualTo("100.00");
  }

  @Test
  void manualTotalRequiresReason() {
    var n = quote();
    n.put("manualTotal", "70");
    assertThatThrownBy(() -> QuoteCalculator.calculate(n)).hasMessageContaining("motivo");
  }

  @Test
  void invalidDiscountsAndFloatRepresentations() {
    var n = quote();
    n.put("discountValue", "101");
    assertThatThrownBy(() -> QuoteCalculator.calculate(n)).hasMessageContaining("100");
    n.put("discountType", "AMOUNT").put("discountValue", "999");
    assertThatThrownBy(() -> QuoteCalculator.calculate(n)).hasMessageContaining("supera");
    n.put("discountValue", "1e2");
    assertThatThrownBy(() -> QuoteCalculator.calculate(n)).hasMessageContaining("decimal");
    n.put("discountValue", "1,20");
    assertThatThrownBy(() -> QuoteCalculator.calculate(n)).hasMessageContaining("decimal");
  }

  @Test
  void quantitiesAreStrictAndNoFreeNegativePrices() {
    var n = quote();
    ((com.fasterxml.jackson.databind.node.ObjectNode) n.get("items").get(0)).put("quantity", "0");
    assertThatThrownBy(() -> QuoteCalculator.calculate(n)).hasMessageContaining("Cantidad");
    ((com.fasterxml.jackson.databind.node.ObjectNode) n.get("items").get(0)).put("quantity", "-1");
    assertThatThrownBy(() -> QuoteCalculator.calculate(n)).hasMessageContaining("decimal");
  }

  @Test
  void businessDaysSkipIssueAndWeekendButNotHolidays() {
    assertThat(QuoteValidity.suggestedExpiry(LocalDate.parse("2026-10-02")))
        .isEqualTo(LocalDate.parse("2026-10-09"));
    assertThat(QuoteValidity.suggestedExpiry(LocalDate.parse("2026-10-03")))
        .isEqualTo(LocalDate.parse("2026-10-09"));
    assertThat(QuoteCalculator.calculate(quote()).snapshot().path("expiryDate").asText())
        .isEqualTo("2026-10-09");
  }

  @Test
  void invalidExpiryAndExcessPrecision() {
    var n = quote();
    n.put("expiryDate", "2026-10-01");
    assertThatThrownBy(() -> QuoteCalculator.calculate(n)).hasMessageContaining("vencimiento");
    n.remove("expiryDate");
    ((com.fasterxml.jackson.databind.node.ObjectNode) n.get("items").get(0))
        .put("unitPrice", "1.005");
    assertThatThrownBy(() -> QuoteCalculator.calculate(n)).hasMessageContaining("decimal");
  }

  @Test
  void optionalClientFieldsAndUnknownKeys() {
    assertThat(client(parse("{\"name\":\"Cliente\"}")).path("phone").asText()).isEmpty();
    assertThatThrownBy(() -> client(parse("{\"name\":\"Cliente\",\"password\":\"secret\"}")))
        .hasMessageContaining("no admitido");
  }

  @Test
  void hostileFilesRejected() throws Exception {
    assertThatThrownBy(() -> AttachmentValidator.validate("MZ executable".getBytes(), "text/plain"))
        .hasMessageContaining("activo");
    assertThatThrownBy(
            () ->
                AttachmentValidator.validate("<script>alert(1)</script>".getBytes(), "text/plain"))
        .hasMessageContaining("activo");
    assertThatThrownBy(() -> AttachmentValidator.validate(new byte[0], "image/png"))
        .hasMessageContaining("vacío");
    assertThatThrownBy(() -> AttachmentValidator.validate("not a jpeg".getBytes(), "image/jpeg"))
        .hasMessageContaining("MIME");
    assertThat(AttachmentValidator.validate("Notas seguras".getBytes(), "text/plain"))
        .isEqualTo("text/plain");
  }
}
