package ar.scalaris.service;

import static ar.scalaris.dto.request.RequestInput.*;
import static ar.scalaris.repository.jdbc.RowValues.number;

import ar.scalaris.repository.jdbc.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PublicImport {
  private final ImportRepository imports;
  private final ClientRepository clients;
  private final Clients clientService;
  private final EventRepository events;
  final Workflow workflow;

  public PublicImport(
      ImportRepository imports,
      ClientRepository clients,
      Clients clientService,
      EventRepository events,
      Workflow workflow) {
    this.imports = imports;
    this.clients = clients;
    this.clientService = clientService;
    this.events = events;
    this.workflow = workflow;
  }

  public ObjectNode validate(JsonNode n) {
    if (encode(n).getBytes(StandardCharsets.UTF_8).length > 32768)
      throw bad("La ficha supera 32 KB.");
    fields(n, "schema", "version", "id", "createdAt", "service", "contact", "answers");
    if (!n.path("schema").asText().equals("scalaris.inquiry")
        || !n.path("version").isIntegralNumber()
        || n.path("version").asInt() != 1) throw bad("Esquema o versión de ficha no admitido.");
    UUID id;
    try {
      String raw = text(n, "id", 36, true);
      id = UUID.fromString(raw);
      if (!id.toString().equalsIgnoreCase(raw)) throw new IllegalArgumentException();
      OffsetDateTime.parse(text(n, "createdAt", 50, true));
    } catch (Exception e) {
      throw bad("Identificador o fecha de ficha inválidos.");
    }
    String service = choice(n, "service", "EQUIPMENT", "PARTS", "SOFTWARE");
    JsonNode contact = n.get("contact"), answers = n.get("answers");
    fields(contact, "name", "phone");
    fields(
        answers,
        "topic",
        "type",
        "model",
        "problem",
        "since",
        "need",
        "scope",
        "requirements",
        "deadline",
        "part",
        "compatibility");
    var out = JSON.createObjectNode();
    out.put("schema", "scalaris.inquiry");
    out.put("version", 1);
    out.put("id", id.toString());
    out.put("createdAt", n.get("createdAt").asText());
    out.put("service", service);
    var c = out.putObject("contact");
    c.put("name", text(contact, "name", 300, true));
    c.put("phone", text(contact, "phone", 100, false));
    var a = out.putObject("answers");
    for (String key :
        List.of(
            "topic",
            "type",
            "model",
            "problem",
            "since",
            "need",
            "scope",
            "requirements",
            "deadline",
            "part",
            "compatibility"))
      a.put(key, text(answers, key, key.equals("topic") ? 300 : 2000, false));
    if (service.equals("EQUIPMENT") && a.path("problem").asText().isBlank())
      throw bad("La ficha requiere una descripción de la consulta.");
    if (service.equals("PARTS") && a.path("part").asText().isBlank())
      throw bad("La ficha requiere el repuesto consultado.");
    if (service.equals("SOFTWARE") && a.path("need").asText().isBlank())
      throw bad("La ficha requiere la necesidad del proyecto.");
    return out;
  }

  static String hash(JsonNode n) {
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256")
                  .digest(encode(n).getBytes(StandardCharsets.UTF_8)));
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  // Content fingerprint deliberately ignores download UUID/time; repeated exports are duplicates
  // too.
  String fingerprint(ObjectNode n) {
    var content = n.deepCopy();
    content.remove(List.of("id", "createdAt"));
    return hash(content);
  }

  public Map<String, Object> preview(JsonNode n) {
    var valid = validate(n);
    var duplicates =
        imports.duplicates(UUID.fromString(valid.get("id").asText()), fingerprint(valid));
    return Map.of("inquiry", valid, "duplicates", duplicates);
  }

  @Transactional
  public Map<String, Object> confirm(JsonNode n) {
    fields(n, "inquiry", "clientId");
    var valid = validate(n.get("inquiry"));
    String fingerprint = fingerprint(valid);
    UUID external = UUID.fromString(valid.get("id").asText());
    // Serialize imports sharing the content key; DB uniqueness remains the final protection.
    imports.lockFingerprint(fingerprint);
    if (imports.exists(external, fingerprint)) throw conflict("Ficha ya importada.");
    long clientId;
    if (n.hasNonNull("clientId")) {
      clientId = id(n, "clientId");
      clients.requireExists(clientId);
    } else {
      clientId = number(clientService.save(null, valid.get("contact")), "id");
    }
    var a = valid.path("answers");
    String service = valid.get("service").asText();
    var data = JSON.createObjectNode();
    data.put(
        "title",
        service.equals("SOFTWARE")
            ? a.path("need").asText().substring(0, Math.min(200, a.path("need").asText().length()))
            : service.equals("PARTS")
                ? a.path("part")
                    .asText()
                    .substring(0, Math.min(200, a.path("part").asText().length()))
                : a.path("topic").asText().isBlank()
                    ? "Consulta por equipo"
                    : a.path("topic").asText());
    if (service.equals("SOFTWARE")) {
      data.put("need", a.path("need").asText());
      data.put("scope", a.path("scope").asText());
      data.put("requirements", a.path("requirements").asText());
    } else {
      data.put("type", a.path("type").asText());
      data.put("model", a.path("model").asText());
      data.put(
          "fault", service.equals("PARTS") ? a.path("part").asText() : a.path("problem").asText());
    }
    String extra =
        service.equals("PARTS")
            ? "Compatibilidad: " + a.path("compatibility").asText()
            : service.equals("SOFTWARE")
                ? "Plazo solicitado: "
                    + a.path("deadline").asText()
                    + "\nIntegraciones: "
                    + a.path("compatibility").asText()
                : "Desde cuándo: "
                    + a.path("since").asText()
                    + "\nUso / alcance: "
                    + a.path("scope").asText()
                    + "\nRequisitos: "
                    + a.path("requirements").asText();
    data.put("notes", extra);
    var request = JSON.createObjectNode();
    request.put("clientId", clientId);
    request.put("service", service);
    request.set("data", data);
    var created = workflow.createCase(request);
    long caseId = number(created, "id");
    imports.create(external, fingerprint, caseId);
    events.event(
        caseId,
        "case",
        caseId,
        "IMPORTED",
        Map.of(
            "externalId", external.toString(), "source", "Ficha pública v1, importación manual"));
    return created;
  }
}
