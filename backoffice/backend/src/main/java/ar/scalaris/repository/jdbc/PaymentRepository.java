package ar.scalaris.repository.jdbc;

import ar.scalaris.domain.Account;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.stereotype.Repository;

/** SQL only: participates in the caller's transaction through the shared JdbcTemplate. */
@Repository
public class PaymentRepository {
  private final JdbcRows rows;

  public PaymentRepository(JdbcRows rows) {
    this.rows = rows;
  }

  private static final String PAID_SQL =
      "SELECT COALESCE(sum(CASE WHEN reverses_id IS NULL THEN amount ELSE -amount END),0) FROM"
          + " payments WHERE case_id=?";

  public BigDecimal paid(long caseId) {
    return rows.scalar(PAID_SQL, BigDecimal.class, caseId);
  }

  public Account account(long caseId) {
    var c = rows.one("SELECT * FROM cases WHERE id=?", caseId);
    var accepted = c.get("accepted_revision_id");
    BigDecimal total =
        accepted == null
            ? BigDecimal.ZERO
            : new BigDecimal(
                rows.one("SELECT total FROM revisions WHERE id=?", accepted)
                    .get("total")
                    .toString());
    return new Account(total, paid(caseId), accepted != null);
  }

  public boolean operationExists(UUID operationKey) {
    return !rows.rows("SELECT id FROM payments WHERE operation_key=?", operationKey).isEmpty();
  }

  public boolean duplicate(
      long caseId, BigDecimal amount, java.time.LocalDate date, String method, String reference) {
    return !rows.rows(
            "SELECT id FROM payments p WHERE case_id=? AND amount=? AND paid_date=? AND method=?"
                + " AND reference=? AND reverses_id IS NULL AND NOT EXISTS(SELECT 1 FROM payments r"
                + " WHERE r.reverses_id=p.id)",
            caseId,
            amount,
            date,
            method,
            reference)
        .isEmpty();
  }

  public Map<String, Object> find(long id, long caseId) {
    return rows.one("SELECT * FROM payments WHERE id=? AND case_id=?", id, caseId);
  }

  public boolean reversed(long id) {
    return !rows.rows("SELECT id FROM payments WHERE reverses_id=?", id).isEmpty();
  }

  public long create(
      long caseId,
      BigDecimal amount,
      java.time.LocalDate date,
      String method,
      String reference,
      String note,
      UUID operationKey) {
    return rows.insert(
        "INSERT INTO payments(case_id,amount,paid_date,method,reference,note,operation_key)"
            + " VALUES(?,?,?,?,?,?,?) RETURNING id",
        caseId,
        amount,
        date,
        method,
        reference,
        note,
        operationKey);
  }

  public long reverse(
      long caseId,
      BigDecimal amount,
      java.time.LocalDate date,
      String reference,
      String reason,
      UUID operationKey,
      long paymentId) {
    return rows.insert(
        "INSERT INTO"
            + " payments(case_id,amount,paid_date,method,reference,note,operation_key,reverses_id)"
            + " VALUES(?,?,?,'Anulación',?,?,?,?) RETURNING id",
        caseId,
        amount,
        date,
        reference,
        reason,
        operationKey,
        paymentId);
  }
}
