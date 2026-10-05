package ar.scalaris.domain;

/** A domain rule failure; its HTTP representation belongs to Errors. */
public final class BusinessRuleException extends RuntimeException {
  public BusinessRuleException(String message) {
    super(message);
  }
}
