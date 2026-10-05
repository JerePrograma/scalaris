package ar.scalaris.service;

import static ar.scalaris.dto.request.RequestInput.*;
import static ar.scalaris.repository.jdbc.RowValues.*;
import static ar.scalaris.service.support.Concurrency.checkVersion;

import ar.scalaris.domain.CaseState;
import ar.scalaris.dto.response.QuoteCalculation;
import ar.scalaris.repository.jdbc.*;
import com.fasterxml.jackson.databind.JsonNode;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class Quotes {
  private final CaseRepository cases;
  private final ClientRepository clients;
  private final RevisionRepository revisions;
  private final PaymentRepository payments;
  private final WorkOrderRepository orders;
  private final EventRepository events;
  private final QuotePdf pdf;

  public Quotes(
      CaseRepository cases,
      ClientRepository clients,
      RevisionRepository revisions,
      PaymentRepository payments,
      WorkOrderRepository orders,
      EventRepository events,
      QuotePdf pdf) {
    this.cases = cases;
    this.clients = clients;
    this.revisions = revisions;
    this.payments = payments;
    this.orders = orders;
    this.events = events;
    this.pdf = pdf;
  }

  public QuoteCalculation calculate(JsonNode n) {
    return QuoteCalculator.calculate(n);
  }

  public byte[] pdf(long revisionId) throws java.io.IOException {
    return pdf.create(revisions.find(revisionId));
  }

  @Transactional
  public Map<String, Object> save(long caseId, Long revisionId, JsonNode n) {
    var c = cases.lockCase(caseId);
    var result = calculate(n);
    var snapshot = result.snapshot();
    snapshot.set("client", data(clients.find(c.get("client_id"))).deepCopy());
    snapshot.put("caseNumber", number(c, "number"));
    snapshot.put("service", c.get("service").toString());
    snapshot.put("caseTitle", data(c).path("title").asText());
    if (c.get("quote_number") == null) {
      cases.allocateQuoteNumber(caseId);
      c = cases.caseRow(caseId);
    }
    snapshot.put("quoteNumber", number(c, "quote_number"));
    long key;
    if (revisionId == null) {
      int rev = revisions.nextRevision(caseId);
      snapshot.put("revision", rev);
      key =
          revisions.create(
              caseId,
              rev,
              snapshot,
              result.subtotal(),
              result.discount(),
              result.adjustment(),
              result.total());
      events.event(caseId, "revision", key, "CREATED", snapshot);
    } else {
      key = revisionId;
      var old = revisions.lock(key, caseId);
      checkVersion(old, n);
      if (!old.get("status").equals("DRAFT"))
        throw conflict("La revisión está congelada. Creá otra revisión.");
      snapshot.put("revision", number(old, "revision"));
      revisions.edit(
          key, snapshot, result.subtotal(), result.discount(), result.adjustment(), result.total());
      events.event(
          caseId,
          "revision",
          key,
          "EDITED",
          Map.of("before", old.get("snapshot"), "after", snapshot));
    }
    return revisions.find(key);
  }

  @Transactional
  public Map<String, Object> send(long caseId, long key, JsonNode n) {
    fields(n, "version");
    var c = cases.lockCase(caseId);
    var r = revisions.lock(key, caseId);
    checkVersion(r, n);
    if (!r.get("status").equals("DRAFT")) throw conflict("Revisión ya enviada.");
    var state = new CaseState(c.get("status").toString(), c.get("accepted_revision_id") != null);
    state.requireQuoteSend();
    revisions.send(key);
    if (state.becomesQuoted()) cases.quoted(caseId);
    events.event(
        caseId,
        "revision",
        key,
        "SENT",
        Map.of(
            "revision",
            r.get("revision"),
            "total",
            r.get("total"),
            "note",
            "Registro manual de envío; no se envió ningún mensaje"));
    return revisions.find(key);
  }

  @Transactional
  public Map<String, Object> accept(long caseId, long key, JsonNode n) {
    fields(n, "version", "date", "channel", "note");
    var c = cases.lockCase(caseId);
    var r = revisions.lock(key, caseId);
    checkVersion(r, n);
    if (!r.get("status").equals("SENT")) throw bad("Solo una revisión enviada puede aceptarse.");
    String status =
        new CaseState(c.get("status").toString(), c.get("accepted_revision_id") != null)
            .acceptedStatus();
    BigDecimal total = new BigDecimal(r.get("total").toString());
    payments.account(caseId).requireReplacementTotal(total);
    Instant accepted;
    try {
      accepted = OffsetDateTime.parse(text(n, "date", 50, true)).toInstant();
    } catch (Exception e) {
      throw bad("Fecha de aceptación inválida, usá ISO con zona horaria.");
    }
    Instant issueStart =
        LocalDate.parse(((JsonNode) r.get("snapshot")).path("issueDate").asText())
            .atStartOfDay(ZONE)
            .toInstant();
    if (accepted.isAfter(Instant.now().plusSeconds(300)) || accepted.isBefore(issueStart))
      throw bad("La aceptación no puede ser anterior a la emisión ni futura.");
    var acceptance =
        Map.of("channel", text(n, "channel", 100, true), "note", text(n, "note", 3000, false));
    revisions.accept(key, accepted, acceptance);
    cases.accept(caseId, key, status);
    orders.assignRevision(caseId, key);
    events.event(
        caseId,
        "revision",
        key,
        "ACCEPTED",
        Map.of(
            "revision",
            r.get("revision"),
            "date",
            accepted.toString(),
            "acceptance",
            acceptance,
            "previousRevision",
            c.get("accepted_revision_id") == null ? "ninguna" : c.get("accepted_revision_id")));
    return revisions.find(key);
  }
}
