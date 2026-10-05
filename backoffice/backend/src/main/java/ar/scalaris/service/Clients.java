package ar.scalaris.service;

import static ar.scalaris.dto.request.RequestInput.*;
import static ar.scalaris.service.support.Concurrency.checkVersion;

import ar.scalaris.dto.request.RequestInput;
import ar.scalaris.repository.jdbc.ClientRepository;
import ar.scalaris.repository.jdbc.EventRepository;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class Clients {
  private final ClientRepository clients;
  private final EventRepository events;

  public Clients(ClientRepository clients, EventRepository events) {
    this.clients = clients;
    this.events = events;
  }

  @Transactional
  public Map<String, Object> save(Long id, JsonNode input) {
    var data = RequestInput.client(input);
    long key;
    if (id == null) {
      key = clients.create(data);
      events.event(null, "client", key, "CREATED", Map.of("fields", data));
    } else {
      key = id;
      var old = clients.lock(id);
      checkVersion(old, input);
      clients.edit(id, data);
      events.event(null, "client", key, "EDITED", Map.of("before", old.get("data"), "after", data));
    }
    return clients.find(key);
  }
}
