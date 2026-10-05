package ar.scalaris.service;

import static ar.scalaris.dto.request.RequestInput.*;

import ar.scalaris.domain.Money;
import ar.scalaris.dto.response.Balance;
import ar.scalaris.mapper.ApiMapper;
import ar.scalaris.repository.jdbc.*;
import com.fasterxml.jackson.databind.JsonNode;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class Payments {
  private final CaseRepository cases;
  private final PaymentRepository payments;
  private final EventRepository events;

  public Payments(CaseRepository cases, PaymentRepository payments, EventRepository events) {
    this.cases = cases;
    this.payments = payments;
    this.events = events;
  }

  @Transactional
  public Balance pay(long caseId, JsonNode n) {
    fields(n, "amount", "date", "method", "reference", "note", "operationKey");
    cases.lockCase(caseId);
    UUID key;
    try {
      key = UUID.fromString(text(n, "operationKey", 36, true));
    } catch (Exception e) {
      throw bad("Identificador de operación inválido.");
    }
    if (payments.operationExists(key))
      throw conflict("Operación ya registrada. Recargá los pagos.");
    var account = payments.account(caseId);
    account.requireAcceptedQuote();
    BigDecimal amount = Money.round(decimal(n, "amount", null, 2));
    account.requirePayment(amount);
    LocalDate date = date(n, "date", LocalDate.now(ZONE));
    if (date.isAfter(LocalDate.now(ZONE))) throw bad("El pago no puede tener fecha futura.");
    String method = text(n, "method", 100, true),
        reference = text(n, "reference", 300, false),
        note = text(n, "note", 3000, false);
    if (payments.duplicate(caseId, amount, date, method, reference))
      throw conflict(
          "Posible pago duplicado: mismo importe, fecha, medio y referencia. Revisá los pagos o usá"
              + " una referencia distinta.");
    long id = payments.create(caseId, amount, date, method, reference, note, key);
    events.event(
        caseId,
        "payment",
        id,
        "PAYMENT",
        Map.of(
            "amount",
            amount.toPlainString(),
            "date",
            date.toString(),
            "method",
            method,
            "reference",
            reference,
            "note",
            note));
    return ApiMapper.balance(payments.account(caseId));
  }

  @Transactional
  public Balance reverse(long caseId, long paymentId, JsonNode n) {
    fields(n, "reason");
    String reason = text(n, "reason", 3000, true);
    cases.lockCase(caseId);
    var p = payments.find(paymentId, caseId);
    if (p.get("reverses_id") != null || payments.reversed(paymentId))
      throw conflict("Este pago no admite otra anulación.");
    long id =
        payments.reverse(
            caseId,
            new BigDecimal(p.get("amount").toString()),
            LocalDate.now(ZONE),
            "Anula #" + paymentId,
            reason,
            UUID.randomUUID(),
            paymentId);
    events.event(
        caseId, "payment", id, "REVERSAL", Map.of("reverses", paymentId, "reason", reason));
    return ApiMapper.balance(payments.account(caseId));
  }
}
