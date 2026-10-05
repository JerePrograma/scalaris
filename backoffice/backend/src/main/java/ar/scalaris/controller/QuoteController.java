package ar.scalaris.controller;

import ar.scalaris.dto.response.*;
import ar.scalaris.mapper.ApiMapper;
import ar.scalaris.service.*;
import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.util.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class QuoteController {
  private final Quotes quotes;

  public QuoteController(Quotes quotes) {
    this.quotes = quotes;
  }

  @PostMapping("/quotes/calculate")
  public QuoteCalculation calculate(@RequestBody JsonNode n) {
    return quotes.calculate(n);
  }

  @PostMapping("/cases/{id}/revisions")
  public Map<String, Object> quote(@PathVariable long id, @RequestBody JsonNode n) {
    return ApiMapper.revision(quotes.save(id, null, n));
  }

  @PutMapping("/cases/{id}/revisions/{rid}")
  public Map<String, Object> quote(
      @PathVariable long id, @PathVariable long rid, @RequestBody JsonNode n) {
    return ApiMapper.revision(quotes.save(id, rid, n));
  }

  @PostMapping("/cases/{id}/revisions/{rid}/send")
  public Map<String, Object> send(
      @PathVariable long id, @PathVariable long rid, @RequestBody JsonNode n) {
    return ApiMapper.revision(quotes.send(id, rid, n));
  }

  @PostMapping("/cases/{id}/revisions/{rid}/accept")
  public Map<String, Object> accept(
      @PathVariable long id, @PathVariable long rid, @RequestBody JsonNode n) {
    return ApiMapper.revision(quotes.accept(id, rid, n));
  }

  @GetMapping("/revisions/{id}/pdf")
  public ResponseEntity<byte[]> pdf(@PathVariable long id) throws IOException {
    return ResponseEntity.ok()
        .header("Content-Disposition", "attachment; filename=presupuesto-" + id + ".pdf")
        .contentType(MediaType.APPLICATION_PDF)
        .body(quotes.pdf(id));
  }
}
