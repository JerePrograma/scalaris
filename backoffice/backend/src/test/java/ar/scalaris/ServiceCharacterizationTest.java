package ar.scalaris;

import static ar.scalaris.dto.request.RequestInput.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import ar.scalaris.domain.*;
import ar.scalaris.mapper.ApiMapper;
import ar.scalaris.repository.jdbc.*;
import ar.scalaris.service.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import org.junit.jupiter.api.Test;

/** Existing business contracts exercised without connecting to an application database. */
class ServiceCharacterizationTest {
  static class Fixture {
    final CaseRepository cases = mock(CaseRepository.class);
    final ClientRepository clients = mock(ClientRepository.class);
    final WorkOrderRepository orders = mock(WorkOrderRepository.class);
    final EventRepository events = mock(EventRepository.class);
    final PaymentRepository payments = mock(PaymentRepository.class);

    Fixture(String state, Long acceptedRevision) {
      var row = new HashMap<String, Object>();
      row.put("version", 0L);
      row.put("status", state);
      row.put("accepted_revision_id", acceptedRevision);
      when(cases.lockCase(1L)).thenReturn(row);
      when(cases.caseRow(1L)).thenReturn(row);
      when(payments.account(1L))
          .thenReturn(
              new Account(new BigDecimal("85.93"), BigDecimal.ZERO, acceptedRevision != null));
    }

    Workflow workflow() {
      return new Workflow(cases, clients, orders, events);
    }

    Payments payments() {
      return new Payments(cases, payments, events);
    }
  }

  @Test
  void balanceStatesAndDecimalWireFormat() {
    var rows = mock(JdbcRows.class);
    when(rows.one("SELECT * FROM cases WHERE id=?", 1L))
        .thenReturn(Map.of("accepted_revision_id", 4L));
    when(rows.one("SELECT total FROM revisions WHERE id=?", 4L))
        .thenReturn(Map.of("total", "85.93"));
    var repository = new PaymentRepository(rows);
    for (var paid : List.of("0", "10", "85.93", "100")) {
      when(rows.scalar(anyString(), eq(BigDecimal.class), eq(1L))).thenReturn(new BigDecimal(paid));
      var result = ApiMapper.balance(repository.account(1L));
      assertThat(result.total()).isEqualTo("85.93");
      assertThat(result.paid()).isEqualTo(Money.round(new BigDecimal(paid)).toPlainString());
      assertThat(result.balance())
          .isEqualTo(
              Money.round(new BigDecimal("85.93").subtract(new BigDecimal(paid))).toPlainString());
      assertThat(result.status())
          .isEqualTo(paid.equals("0") ? "UNPAID" : paid.equals("10") ? "PARTIAL" : "PAID");
    }
    when(rows.one("SELECT * FROM cases WHERE id=?", 1L)).thenReturn(Map.of());
    when(rows.scalar(anyString(), eq(BigDecimal.class), eq(1L))).thenReturn(BigDecimal.ZERO);
    assertThat(ApiMapper.balance(repository.account(1L)).status()).isEqualTo("UNPAID");
    assertThat(ApiMapper.balance(repository.account(1L)).balance()).isEqualTo("0.00");
  }

  @Test
  void transitionsRequireActualQuoteAndAcceptanceForReopening() {
    var workflow = new Fixture("INQUIRY", null).workflow();
    assertThatThrownBy(
            () ->
                workflow.transition(
                    1, parse("{\"version\":0,\"status\":\"INQUIRY\",\"reason\":\"Motivo\"}")))
        .hasMessageContaining("no cambia");
    for (String target : List.of("QUOTED", "ACCEPTED"))
      assertThatThrownBy(
              () ->
                  workflow.transition(
                      1,
                      parse("{\"version\":0,\"status\":\"" + target + "\",\"reason\":\"Motivo\"}")))
          .hasMessageContaining("revisión concreta");
    for (String target : List.of("WORKING", "READY"))
      assertThatThrownBy(
              () ->
                  workflow.transition(
                      1,
                      parse(
                          "{\"version\":0,\"status\":\""
                              + target
                              + "\",\"reason\":\"Motivo\",\"correction\":true}")))
          .hasMessageContaining("presupuesto aceptado");
    assertThatThrownBy(
            () ->
                workflow.transition(
                    1, parse("{\"version\":0,\"status\":\"WORKING\",\"reason\":\"Motivo\"}")))
        .hasMessageContaining("incoherente");
    assertThatThrownBy(
            () ->
                workflow.transition(
                    1,
                    parse(
                        "{\"version\":0,\"status\":\"DIAGNOSIS\",\"reason\":\"Motivo\",\"correction\":\"true\"}")))
        .hasMessageContaining("verdadero o falso");
  }

  @Test
  void deliveryRequiresRecordedDeliveryButDoesNotRequirePayment() {
    var f = new Fixture("READY", 4L);
    when(f.orders.deliveryData(1L)).thenReturn(Map.of("data", parse("{\"delivery\":\"\"}")));
    var request = parse("{\"version\":0,\"status\":\"DELIVERED\",\"reason\":\"Entrega\"}");
    assertThatThrownBy(() -> f.workflow().transition(1, request))
        .hasMessageContaining("Registrá la entrega");
    when(f.orders.deliveryData(1L))
        .thenReturn(Map.of("data", parse("{\"delivery\":\"Recibido por el cliente\"}")));
    assertThatCode(() -> f.workflow().transition(1, request)).doesNotThrowAnyException();
    verify(f.payments, never()).paid(anyLong());
    verify(f.cases).transition(1L, "DELIVERED");
    verify(f.events).event(eq(1L), eq("case"), eq(1L), eq("STATUS"), any());
  }

  @Test
  void paymentRejectsMissingAcceptanceNonPositiveExcessAndFutureDates() {
    var request = JSON.createObjectNode();
    request
        .put("amount", "10")
        .put("date", LocalDate.now(ZONE).toString())
        .put("method", "Efectivo")
        .put("operationKey", UUID.randomUUID().toString());
    assertThatThrownBy(() -> new Fixture("INQUIRY", null).payments().pay(1, request))
        .hasMessageContaining("revisión aceptada");
    var f = new Fixture("ACCEPTED", 4L);
    for (String amount : List.of("0", "85.94")) {
      request.put("amount", amount);
      assertThatThrownBy(() -> f.payments().pay(1, request)).hasMessageContaining("saldo");
    }
    request.put("amount", "10").put("date", LocalDate.now(ZONE).plusDays(1).toString());
    assertThatThrownBy(() -> f.payments().pay(1, request)).hasMessageContaining("fecha futura");
    verify(f.payments, never())
        .create(anyLong(), any(), any(), anyString(), anyString(), anyString(), any());
  }
}
