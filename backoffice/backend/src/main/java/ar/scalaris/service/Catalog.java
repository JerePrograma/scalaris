package ar.scalaris.service;

import static ar.scalaris.dto.request.RequestInput.*;
import static ar.scalaris.service.support.Concurrency.checkVersion;

import ar.scalaris.domain.Money;
import ar.scalaris.repository.jdbc.CatalogRepository;
import ar.scalaris.repository.jdbc.EventRepository;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class Catalog {
  private final CatalogRepository catalog;
  private final EventRepository events;

  public Catalog(CatalogRepository catalog, EventRepository events) {
    this.catalog = catalog;
    this.events = events;
  }

  @Transactional
  public Map<String, Object> save(Long id, JsonNode input) {
    fields(input, "description", "kind", "unit", "price", "active", "version");
    String description = text(input, "description", 1000, true);
    String kind = choice(input, "kind", "LABOR", "PART", "OTHER");
    String unit = text(input, "unit", 40, true);
    var price = Money.round(decimal(input, "price", null, 2));
    if (!input.path("active").isBoolean()) throw bad("Estado activo inválido.");
    boolean active = input.get("active").asBoolean();
    long key;
    if (id == null) {
      key = catalog.create(description, kind, unit, price, active);
      events.event(null, "catalog", key, "CREATED", input);
    } else {
      key = id;
      var old = catalog.lock(id);
      checkVersion(old, input);
      catalog.edit(id, description, kind, unit, price, active);
      events.event(null, "catalog", key, "EDITED", Map.of("before", old, "after", input));
    }
    return catalog.find(key);
  }
}
