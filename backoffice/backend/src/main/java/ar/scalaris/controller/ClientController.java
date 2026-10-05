package ar.scalaris.controller;

import ar.scalaris.dto.response.*;
import ar.scalaris.mapper.ApiMapper;
import ar.scalaris.service.*;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class ClientController {
  private final Clients clients;

  public ClientController(Clients clients) {
    this.clients = clients;
  }

  @PostMapping("/clients")
  public Map<String, Object> client(@RequestBody JsonNode n) {
    return ApiMapper.client(clients.save(null, n));
  }

  @PutMapping("/clients/{id}")
  public Map<String, Object> client(@PathVariable long id, @RequestBody JsonNode n) {
    return ApiMapper.client(clients.save(id, n));
  }
}
