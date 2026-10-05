package ar.scalaris.controller;

import ar.scalaris.dto.response.*;
import ar.scalaris.service.*;
import java.time.LocalDate;
import java.util.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class ReadController {
  private final BackofficeQueries queries;

  public ReadController(BackofficeQueries queries) {
    this.queries = queries;
  }

  @GetMapping("/health")
  public Health health() {
    return queries.health();
  }

  @GetMapping("/dashboard")
  public Dashboard dashboard() {
    return queries.dashboard();
  }

  @GetMapping("/clients")
  public List<Map<String, Object>> clients(@RequestParam(defaultValue = "") String q) {
    return queries.clients(q);
  }

  @GetMapping("/catalog")
  public List<Map<String, Object>> catalog() {
    return queries.catalog();
  }

  @GetMapping("/cases")
  public List<Map<String, Object>> cases(
      @RequestParam(defaultValue = "") String q,
      @RequestParam(defaultValue = "") String service,
      @RequestParam(defaultValue = "") String status,
      @RequestParam(required = false) Long clientId,
      @RequestParam(required = false) LocalDate from,
      @RequestParam(required = false) LocalDate to,
      @RequestParam(defaultValue = "0") int offset) {
    return queries.cases(q, service, status, clientId, from, to, offset);
  }

  @GetMapping("/cases/{id}")
  public Detail detail(@PathVariable long id) {
    return queries.detail(id);
  }

  @GetMapping("/audit")
  public List<Map<String, Object>> audit(@RequestParam(defaultValue = "0") int offset) {
    return queries.audit(offset);
  }
}
