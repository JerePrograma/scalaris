package ar.scalaris.service;

import static ar.scalaris.dto.request.RequestInput.*;
import static ar.scalaris.service.support.Concurrency.checkVersion;

import ar.scalaris.domain.CaseState;
import ar.scalaris.repository.jdbc.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Case and work-order coordination; SQL remains in repositories and state invariants in domain. */
@Service
public class Workflow {
  private final CaseRepository cases;
  private final ClientRepository clients;
  private final WorkOrderRepository orders;
  private final EventRepository events;

  public Workflow(
      CaseRepository cases,
      ClientRepository clients,
      WorkOrderRepository orders,
      EventRepository events) {
    this.cases = cases;
    this.clients = clients;
    this.orders = orders;
    this.events = events;
  }

  @Transactional
  public Map<String, Object> createCase(JsonNode input) {
    fields(input, "clientId", "service", "data");
    long clientId = id(input, "clientId");
    clients.requireExists(clientId);
    String service = choice(input, "service", "EQUIPMENT", "PARTS", "SOFTWARE");
    var data = caseData(input.get("data"), service);
    long key = cases.create(clientId, service, data);
    events.event(key, "case", key, "CREATED", Map.of("service", service, "data", data));
    return cases.caseRow(key);
  }

  @Transactional
  public Map<String, Object> editCase(long id, JsonNode input) {
    fields(input, "clientId", "data", "version");
    var old = cases.lockCase(id);
    checkVersion(old, input);
    long clientId = id(input, "clientId");
    clients.requireExists(clientId);
    var data = caseData(input.get("data"), old.get("service").toString());
    cases.edit(id, clientId, data);
    events.event(
        id,
        "case",
        id,
        "EDITED",
        Map.of("before", old.get("data"), "after", data, "clientId", clientId));
    return cases.caseRow(id);
  }

  @Transactional
  public Map<String, Object> transition(long id, JsonNode input) {
    fields(input, "status", "reason", "correction", "version");
    var old = cases.lockCase(id);
    checkVersion(old, input);
    String from = old.get("status").toString();
    String to =
        choice(
            input,
            "status",
            "INQUIRY",
            "DIAGNOSIS",
            "QUOTED",
            "ACCEPTED",
            "WORKING",
            "READY",
            "DELIVERED",
            "REJECTED",
            "CANCELLED");
    String reason = text(input, "reason", 1500, true);
    if (input.has("correction") && !input.get("correction").isBoolean())
      throw bad("Corrección debe ser verdadero o falso.");
    var state = new CaseState(from, old.get("accepted_revision_id") != null);
    state.requireTransition(to, input.path("correction").asBoolean(false));
    if (to.equals("DELIVERED"))
      state.requireDelivery(
          ((JsonNode) orders.deliveryData(id).get("data")).path("delivery").asText());
    cases.transition(id, to);
    events.event(
        id,
        "case",
        id,
        input.path("correction").asBoolean() ? "REOPENED" : "STATUS",
        Map.of("from", from, "to", to, "reason", reason));
    return cases.caseRow(id);
  }

  @Transactional
  public void note(long id, JsonNode input) {
    fields(input, "text");
    cases.lockCase(id);
    events.event(id, "case", id, "NOTE", Map.of("text", text(input, "text", 6000, true)));
  }

  @Transactional
  public Map<String, Object> work(long id, JsonNode input) {
    fields(input, "tasks", "progress", "actualHours", "reception", "delivery", "version");
    cases.lockCase(id);
    var old = orders.lock(id);
    checkVersion(old, input);
    if (!input.path("tasks").isArray() || input.get("tasks").size() > 100)
      throw bad("Máximo 100 tareas.");
    ObjectNode data = JSON.createObjectNode();
    var tasks = data.putArray("tasks");
    for (var task : input.get("tasks")) {
      fields(task, "text", "done");
      if (!task.path("done").isBoolean()) throw bad("Estado de tarea inválido.");
      tasks
          .addObject()
          .put("text", text(task, "text", 1000, true))
          .put("done", task.get("done").asBoolean());
    }
    for (String key : List.of("progress", "reception", "delivery"))
      data.put(key, text(input, key, 6000, false));
    data.put(
        "actualHours", decimal(input, "actualHours", java.math.BigDecimal.ZERO, 3).toPlainString());
    orders.edit(id, data);
    events.event(id, "work_order", id, "EDITED", Map.of("before", old.get("data"), "after", data));
    return orders.find(id);
  }
}
