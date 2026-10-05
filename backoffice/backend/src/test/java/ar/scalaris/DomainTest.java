package ar.scalaris;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import ar.scalaris.controller.*;
import ar.scalaris.domain.*;
import ar.scalaris.dto.request.RequestInput;
import ar.scalaris.mapper.ApiMapper;
import ar.scalaris.repository.jdbc.*;
import ar.scalaris.service.*;
import java.math.BigDecimal;
import java.util.*;
import org.junit.jupiter.api.Test;

class DomainTest {
  @Test
  void dashboardPendingCountUsesExistingCaseSemantics() {
    var repository = mock(BackofficeRepository.class);
    var rows = new ArrayList<Map<String, Object>>();
    for (String status :
        List.of(
            "INQUIRY",
            "DIAGNOSIS",
            "QUOTED",
            "ACCEPTED",
            "WORKING",
            "READY",
            "DELIVERED",
            "REJECTED",
            "CANCELLED")) rows.add(Map.of("status", status, "count", 2L));
    when(repository.counts()).thenReturn(rows);
    when(repository.balances()).thenReturn(Map.of("balance", "0.00", "pending", 0L));
    var dashboard = new BackofficeQueries(repository).dashboard();
    assertThat(dashboard.pendingCases()).isEqualTo(10);
    assertThat(dashboard.counts()).hasSize(9);
    assertThat(CaseState.pendingStatuses())
        .containsExactly("INQUIRY", "DIAGNOSIS", "QUOTED", "ACCEPTED", "WORKING");
    assertThatThrownBy(() -> CaseState.pendingStatuses().add("READY"))
        .isInstanceOf(UnsupportedOperationException.class);
  }

  @Test
  void accountRejectsOverpaymentAndAcceptanceBelowEffectivePayments() {
    var account = new Account(new BigDecimal("85.93"), new BigDecimal("10.00"), true);
    assertThat(account.balance()).isEqualByComparingTo("75.93");
    assertThatCode(() -> account.requirePayment(new BigDecimal("75.93")))
        .doesNotThrowAnyException();
    assertThatThrownBy(() -> account.requirePayment(new BigDecimal("75.94")))
        .hasMessageContaining("saldo");
    assertThatThrownBy(() -> account.requireReplacementTotal(new BigDecimal("9.99")))
        .hasMessageContaining("pagos vigentes");
    assertThatCode(() -> account.requireReplacementTotal(new BigDecimal("10")))
        .doesNotThrowAnyException();
    assertThat(new CaseState("WORKING", true).acceptedStatus()).isEqualTo("WORKING");
    assertThat(new CaseState("READY", true).acceptedStatus()).isEqualTo("READY");
    assertThat(new CaseState("QUOTED", false).acceptedStatus()).isEqualTo("ACCEPTED");
  }

  @Test
  void calculationSnapshotsAndWebMappingsDoNotExposeMutableState() {
    var result = QuoteCalculator.calculate(RulesTest.quote());
    var first = result.snapshot();
    first.put("currency", "USD");
    ((com.fasterxml.jackson.databind.node.ObjectNode) first.path("items").get(0))
        .put("unitPrice", "0");
    assertThat(result.snapshot().path("currency").asText()).isEqualTo("ARS");
    assertThat(result.snapshot().path("items").get(0).path("unitPrice").asText())
        .isEqualTo("100.00");
    var source = RequestInput.JSON.createObjectNode().put("name", "Cliente");
    var mapped =
        ApiMapper.client(Map.of("id", 1L, "data", source, "internal_future_column", "private"));
    assertThat(mapped).doesNotContainKey("internal_future_column");
    source.put("name", "Cambio");
    assertThat(((com.fasterxml.jackson.databind.JsonNode) mapped.get("data")).path("name").asText())
        .isEqualTo("Cliente");
    assertThatThrownBy(() -> mapped.put("id", 2L))
        .isInstanceOf(UnsupportedOperationException.class);
  }
}
