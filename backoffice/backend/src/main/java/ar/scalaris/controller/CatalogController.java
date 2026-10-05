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
public class CatalogController {
  private final Catalog catalog;

  public CatalogController(Catalog catalog) {
    this.catalog = catalog;
  }

  @PostMapping("/catalog")
  public Map<String, Object> catalog(@RequestBody JsonNode n) {
    return ApiMapper.catalog(catalog.save(null, n));
  }

  @PutMapping("/catalog/{id}")
  public Map<String, Object> catalog(@PathVariable long id, @RequestBody JsonNode n) {
    return ApiMapper.catalog(catalog.save(id, n));
  }
}
