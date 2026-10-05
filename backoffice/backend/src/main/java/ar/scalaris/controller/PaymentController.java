package ar.scalaris.controller;

import ar.scalaris.dto.response.*;
import ar.scalaris.service.*;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class PaymentController {
  private final Payments payments;

  public PaymentController(Payments payments) {
    this.payments = payments;
  }

  @PostMapping("/cases/{id}/payments")
  public Balance payment(@PathVariable long id, @RequestBody JsonNode n) {
    return payments.pay(id, n);
  }

  @PostMapping("/cases/{id}/payments/{pid}/reverse")
  public Balance reverse(@PathVariable long id, @PathVariable long pid, @RequestBody JsonNode n) {
    return payments.reverse(id, pid, n);
  }
}
