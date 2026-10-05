package ar.scalaris.controller;

import ar.scalaris.domain.BusinessRuleException;
import ar.scalaris.exception.MissingRecordException;
import java.util.Map;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class Errors {
  @ExceptionHandler(MissingRecordException.class)
  ResponseEntity<?> missing(MissingRecordException e) {
    return ResponseEntity.status(404).body(Map.of("message", e.getMessage()));
  }

  @ExceptionHandler(BusinessRuleException.class)
  ResponseEntity<?> businessRule(BusinessRuleException e) {
    return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
  }

  @ExceptionHandler(ResponseStatusException.class)
  ResponseEntity<?> validation(ResponseStatusException e) {
    return ResponseEntity.status(e.getStatusCode())
        .body(Map.of("message", e.getReason() == null ? "Solicitud inválida." : e.getReason()));
  }

  @ExceptionHandler(DataIntegrityViolationException.class)
  ResponseEntity<?> conflict() {
    return ResponseEntity.status(409)
        .body(
            Map.of(
                "message", "Conflicto de datos o registro duplicado. Recargá e intentá de nuevo."));
  }

  @ExceptionHandler({HttpMessageNotReadableException.class, IllegalArgumentException.class})
  ResponseEntity<?> bad() {
    return ResponseEntity.badRequest().body(Map.of("message", "Formato de solicitud inválido."));
  }

  @ExceptionHandler(MaxUploadSizeExceededException.class)
  ResponseEntity<?> size() {
    return ResponseEntity.status(413)
        .body(Map.of("message", "Adjunto demasiado grande: máximo 8 MB."));
  }

  @ExceptionHandler(java.io.IOException.class)
  ResponseEntity<?> io() {
    return ResponseEntity.status(500)
        .body(
            Map.of(
                "message",
                "No se pudo leer o guardar el archivo. Revisá el almacenamiento configurado."));
  }
}
