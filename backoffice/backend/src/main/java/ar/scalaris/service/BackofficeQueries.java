package ar.scalaris.service;

import static ar.scalaris.dto.request.RequestInput.*;

import ar.scalaris.domain.CaseState;
import ar.scalaris.dto.response.*;
import ar.scalaris.mapper.ApiMapper;
import ar.scalaris.repository.jdbc.BackofficeRepository;
import java.time.LocalDate;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Coordinates read use cases and explicitly maps their public contract. */
@Service
@Transactional(readOnly = true)
public class BackofficeQueries {
  private final BackofficeRepository repository;

  public BackofficeQueries(BackofficeRepository repository) {
    this.repository = repository;
  }

  public Health health() {
    return new Health("ok", repository.checkConnection(), ZONE.toString());
  }

  public Dashboard dashboard() {
    var counts = repository.counts();
    long pending =
        counts.stream()
            .filter(row -> CaseState.pending(row.get("status").toString()))
            .mapToLong(row -> ((Number) row.get("count")).longValue())
            .sum();
    return new Dashboard(
        counts,
        repository.balances(),
        repository.recent().stream().map(ApiMapper::caseView).toList(),
        pending);
  }

  public List<Map<String, Object>> clients(String q) {
    if (q.length() > 300) throw bad("Búsqueda demasiado larga.");
    return repository.clients(q).stream().map(ApiMapper::client).toList();
  }

  public List<Map<String, Object>> catalog() {
    return repository.catalog().stream().map(ApiMapper::catalog).toList();
  }

  public List<Map<String, Object>> cases(
      String q,
      String service,
      String status,
      Long clientId,
      LocalDate from,
      LocalDate to,
      int offset) {
    if (q.length() > 300 || offset < 0) throw bad("Filtro inválido.");
    return repository
        .cases(
            q,
            service,
            status,
            clientId,
            from,
            to,
            offset,
            status.equals("OPEN") ? CaseState.pendingStatuses() : List.of())
        .stream()
        .map(ApiMapper::caseView)
        .toList();
  }

  public Detail detail(long id) {
    var c = repository.caseRow(id);
    var work = repository.work(id);
    return new Detail(
        ApiMapper.caseView(c),
        ApiMapper.client(repository.client(c.get("client_id"))),
        repository.revisions(id).stream().map(ApiMapper::revision).toList(),
        work == null ? null : ApiMapper.work(work),
        ApiMapper.balance(repository.account(id)),
        repository.payments(id).stream().map(ApiMapper::payment).toList(),
        repository.attachments(id).stream().map(ApiMapper::attachment).toList(),
        repository.events(id).stream().map(ApiMapper::event).toList());
  }

  public List<Map<String, Object>> audit(int offset) {
    if (offset < 0) throw bad("Página inválida.");
    return repository.audit(offset).stream().map(ApiMapper::event).toList();
  }
}
