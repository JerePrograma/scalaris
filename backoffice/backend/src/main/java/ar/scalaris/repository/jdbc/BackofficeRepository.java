package ar.scalaris.repository.jdbc;

import ar.scalaris.domain.Account;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;
import org.springframework.stereotype.Repository;

/** Read queries for the existing backoffice. Business interpretation belongs to its consumers. */
@Repository
public class BackofficeRepository {
  private static final ZoneId ZONE = ZoneId.of("America/Argentina/Buenos_Aires");
  private final JdbcRows s;
  private final CaseRepository cases;
  private final PaymentRepository payments;

  public BackofficeRepository(JdbcRows s, CaseRepository cases, PaymentRepository payments) {
    this.s = s;
    this.cases = cases;
    this.payments = payments;
  }

  public int checkConnection() {
    return s.scalar("SELECT 1", Integer.class);
  }

  public List<Map<String, Object>> counts() {
    return s.rows("SELECT status,count(*) AS count FROM cases GROUP BY status");
  }

  public Map<String, Object> balances() {
    return s.one(
        "SELECT COALESCE(sum(r.total-COALESCE(p.paid,0)),0) AS balance,count(*) FILTER(WHERE"
            + " r.total>COALESCE(p.paid,0)) AS pending FROM cases c JOIN revisions r ON"
            + " r.id=c.accepted_revision_id LEFT JOIN (SELECT case_id,sum(CASE WHEN reverses_id"
            + " IS NULL THEN amount ELSE -amount END) AS paid FROM payments GROUP BY case_id)p"
            + " ON p.case_id=c.id");
  }

  public List<Map<String, Object>> recent() {
    return s.rows(
        "SELECT c.*,cl.data AS client FROM cases c JOIN clients cl ON cl.id=c.client_id ORDER"
            + " BY c.updated_at DESC LIMIT 8");
  }

  public List<Map<String, Object>> clients(String q) {
    return s.rows(
        "SELECT * FROM clients WHERE data->>'name' ILIKE ? OR data->>'phone' ILIKE ? ORDER BY"
            + " data->>'name' LIMIT 500",
        "%" + q + "%",
        "%" + q + "%");
  }

  public Map<String, Object> client(Object id) {
    return s.one("SELECT * FROM clients WHERE id=?", id);
  }

  public List<Map<String, Object>> catalog() {
    return s.rows("SELECT * FROM catalog ORDER BY id");
  }

  public List<Map<String, Object>> cases(
      String q,
      String service,
      String status,
      Long clientId,
      LocalDate from,
      LocalDate to,
      int offset,
      List<String> matchingStatuses) {
    var args = new ArrayList<Object>();
    String sql =
        "SELECT c.*,cl.data AS client FROM cases c JOIN clients cl ON cl.id=c.client_id WHERE"
            + " (cl.data->>'name' ILIKE ? OR c.data->>'title' ILIKE ? OR c.number::text=? OR"
            + " c.data::text ILIKE ?)";
    args.addAll(List.of("%" + q + "%", "%" + q + "%", q, "%" + q + "%"));
    if (!service.isEmpty()) {
      sql += " AND c.service=?";
      args.add(service);
    }
    if (status.equals("OPEN")) {
      sql += " AND c.status IN (";
      sql += String.join(",", Collections.nCopies(matchingStatuses.size(), "?")) + ")";
      args.addAll(matchingStatuses);
    } else if (!status.isEmpty()) {
      sql += " AND c.status=?";
      args.add(status);
    }
    if (clientId != null) {
      sql += " AND c.client_id=?";
      args.add(clientId);
    }
    if (from != null) {
      sql += " AND c.created_at>=?";
      args.add(java.sql.Timestamp.from(from.atStartOfDay(ZONE).toInstant()));
    }
    if (to != null) {
      sql += " AND c.created_at<?";
      args.add(java.sql.Timestamp.from(to.plusDays(1).atStartOfDay(ZONE).toInstant()));
    }
    sql += " ORDER BY c.updated_at DESC LIMIT 100 OFFSET ?";
    args.add(offset);
    return s.rows(sql, args.toArray());
  }

  public Map<String, Object> caseRow(long id) {
    return cases.caseRow(id);
  }

  public Account account(long id) {
    return payments.account(id);
  }

  public List<Map<String, Object>> revisions(long id) {
    return s.rows("SELECT * FROM revisions WHERE case_id=? ORDER BY revision DESC", id);
  }

  public Map<String, Object> work(long id) {
    return s.rows("SELECT * FROM work_orders WHERE case_id=?", id).stream()
        .findFirst()
        .orElse(null);
  }

  public List<Map<String, Object>> payments(long id) {
    return s.rows("SELECT * FROM payments WHERE case_id=? ORDER BY id DESC", id);
  }

  public List<Map<String, Object>> attachments(long id) {
    return s.rows("SELECT * FROM attachments WHERE case_id=? ORDER BY id", id);
  }

  public List<Map<String, Object>> events(long id) {
    return s.rows("SELECT * FROM events WHERE case_id=? ORDER BY id DESC", id);
  }

  public List<Map<String, Object>> audit(int offset) {
    return s.rows("SELECT * FROM events ORDER BY id DESC LIMIT 100 OFFSET ?", offset);
  }
}
