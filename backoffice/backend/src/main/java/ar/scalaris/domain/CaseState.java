package ar.scalaris.domain;

import java.util.*;

/** The case owns its transition rules; application services supply facts loaded under a lock. */
public final class CaseState {
  private static final Set<String> CLOSED = Set.of("DELIVERED", "CANCELLED", "REJECTED");
  private static final List<String> PENDING =
      List.of("INQUIRY", "DIAGNOSIS", "QUOTED", "ACCEPTED", "WORKING");
  private static final Map<String, Set<String>> NEXT =
      Map.of(
          "INQUIRY", Set.of("DIAGNOSIS", "CANCELLED"),
          "DIAGNOSIS", Set.of("CANCELLED"),
          "QUOTED", Set.of("REJECTED", "CANCELLED"),
          "ACCEPTED", Set.of("WORKING", "CANCELLED"),
          "WORKING", Set.of("READY", "CANCELLED"),
          "READY", Set.of("DELIVERED", "WORKING", "CANCELLED"));
  private final String status;
  private final boolean accepted;

  public CaseState(String status, boolean accepted) {
    this.status = Objects.requireNonNull(status);
    this.accepted = accepted;
  }

  public static boolean pending(String status) {
    return PENDING.contains(status);
  }

  public static List<String> pendingStatuses() {
    return PENDING;
  }

  public void requireTransition(String target, boolean correction) {
    if (status.equals(target)) throw new BusinessRuleException("El estado no cambia.");
    if (target.equals("ACCEPTED") || target.equals("QUOTED"))
      throw new BusinessRuleException(
          "Este estado requiere enviar o aceptar una revisión concreta.");
    if (correction) {
      if (Set.of("WORKING", "READY", "DELIVERED").contains(target) && !accepted)
        throw new BusinessRuleException("Se requiere presupuesto aceptado.");
      if (!Set.of("INQUIRY", "DIAGNOSIS", "WORKING", "READY").contains(target))
        throw new BusinessRuleException(
            "La corrección debe reabrir en consulta, diagnóstico, en trabajo o listo.");
    } else if (!NEXT.getOrDefault(status, Set.of()).contains(target))
      throw new BusinessRuleException(
          "Transición incoherente. Usá corrección/reapertura con motivo.");
  }

  public void requireDelivery(String delivery) {
    if (delivery.isBlank())
      throw new BusinessRuleException("Registrá la entrega en la orden antes de cerrar.");
  }

  public void requireQuoteSend() {
    if (CLOSED.contains(status))
      throw new BusinessRuleException("Reabrí el caso antes de enviar un presupuesto.");
    if (status.equals("INQUIRY"))
      throw new BusinessRuleException("Pasá por diagnóstico/relevamiento antes de enviar.");
  }

  public boolean becomesQuoted() {
    return Set.of("DIAGNOSIS", "QUOTED").contains(status);
  }

  public String acceptedStatus() {
    if (!Set.of("QUOTED", "ACCEPTED", "WORKING", "READY").contains(status))
      throw new BusinessRuleException(
          "Estado incompatible con aceptación. Reabrí y enviá el presupuesto.");
    return Set.of("WORKING", "READY").contains(status) ? status : "ACCEPTED";
  }
}
