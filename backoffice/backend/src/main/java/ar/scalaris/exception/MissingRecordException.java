package ar.scalaris.exception;

/** Missing persisted record; the controller advice supplies its HTTP representation. */
public final class MissingRecordException extends RuntimeException {
  public MissingRecordException() {
    super("Registro inexistente.");
  }
}
