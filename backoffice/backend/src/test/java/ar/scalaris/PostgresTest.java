package ar.scalaris;

import static ar.scalaris.dto.request.RequestInput.*;
import static ar.scalaris.repository.jdbc.RowValues.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import ar.scalaris.controller.*;
import ar.scalaris.domain.*;
import ar.scalaris.repository.jdbc.*;
import ar.scalaris.service.*;
import ar.scalaris.storage.AttachmentValidator;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.file.Path;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/** Explicit disposable DB only. These tests never target the normal application's database. */
@SpringBootTest
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariable(
    named = "SCALARIS_TEST_DB_URL",
    matches = ".+/scalaris_test_[a-zA-Z0-9_]+")
class PostgresTest {
  @DynamicPropertySource
  static void config(DynamicPropertyRegistry r) {
    String url = System.getenv("SCALARIS_TEST_DB_URL");
    if (url == null
        || !url.matches(
            "jdbc:postgresql://(127\\.0\\.0\\.1|localhost):\\d+/scalaris_test_[a-zA-Z0-9_]+"))
      throw new IllegalStateException("Se requiere base local descartable scalaris_test_*");
    r.add("spring.datasource.url", () -> url);
    r.add("spring.datasource.username", () -> System.getenv("SCALARIS_TEST_DB_USER"));
    r.add(
        "spring.datasource.password",
        () -> Objects.toString(System.getenv("SCALARIS_TEST_DB_PASSWORD"), ""));
    Path disposableStorage =
        Path.of(
                System.getProperty("java.io.tmpdir"),
                "scalaris-test-files",
                url.substring(url.lastIndexOf('/') + 1),
                UUID.randomUUID().toString())
            .toAbsolutePath();
    r.add("scalaris.storage", disposableStorage::toString);
    r.add("scalaris.allowed-origins", () -> "http://localhost:8081,http://127.0.0.1:8081");
  }

  @Autowired JdbcRows s;
  @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;
  @Autowired CaseRepository caseRepository;
  @Autowired PaymentRepository paymentRepository;
  @Autowired Clients clients;
  @Autowired Catalog catalog;
  @Autowired Workflow workflow;
  @Autowired Quotes quotes;
  @Autowired Payments payments;
  @Autowired PublicImport imports;
  @Autowired AttachmentService files;
  @Autowired ar.scalaris.storage.StorageLock storage;
  @Autowired QuotePdf pdf;
  @Autowired MockMvc mvc;

  @BeforeEach
  void clear() {
    jdbc.execute(
        "TRUNCATE imports,events,attachments,payments,work_orders,cases,revisions,clients RESTART"
            + " IDENTITY CASCADE");
  }

  long createCase() {
    long client = number(clients.save(null, parse("{\"name\":\"Cliente de prueba\"}")), "id");
    return number(
        workflow.createCase(
            parse(
                "{\"clientId\":"
                    + client
                    + ",\"service\":\"EQUIPMENT\",\"data\":{\"title\":\"Prueba\",\"model\":\"PC\"}}")),
        "id");
  }

  void diagnosis(long id) {
    workflow.transition(
        id,
        parse(
            "{\"version\":"
                + caseRepository.caseRow(id).get("version")
                + ",\"status\":\"DIAGNOSIS\",\"reason\":\"Revisión\"}"));
  }

  Map<String, Object> send(long id) {
    var r = quotes.save(id, null, RulesTest.quote());
    return quotes.send(id, number(r, "id"), parse("{\"version\":" + r.get("version") + "}"));
  }

  Map<String, Object> accept(long id, Map<String, Object> r) {
    var n = JSON.createObjectNode();
    n.put("version", number(r, "version"));
    n.put("date", Instant.now().toString());
    n.put("channel", "Presencial");
    n.put("note", "Registro de prueba");
    return quotes.accept(id, number(r, "id"), n);
  }

  ObjectNode payment(String amount) {
    var n = JSON.createObjectNode();
    n.put("amount", amount);
    n.put("date", LocalDate.now(ZONE).toString());
    n.put("method", "Efectivo");
    n.put("reference", "test");
    n.put("operationKey", UUID.randomUUID().toString());
    return n;
  }

  @Test
  void httpReadUseCasesPreserveContractAndAuthoritativeBalances() throws Exception {
    long id = createCase();
    diagnosis(id);
    accept(id, send(id));
    payments.pay(id, payment("10"));
    mvc.perform(get("/api/dashboard").header("Host", "localhost:8081"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.pendingCases").value(1))
        .andExpect(jsonPath("$.balances.balance").value("75.93"))
        .andExpect(jsonPath("$.counts[0].status").value("ACCEPTED"))
        .andExpect(jsonPath("$.recent[0].client.name").value("Cliente de prueba"));
    mvc.perform(get("/api/cases").header("Host", "localhost:8081").param("status", "OPEN"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].id").value(id));
    mvc.perform(get("/api/cases/" + id).header("Host", "localhost:8081"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.case.status").value("ACCEPTED"))
        .andExpect(jsonPath("$.balance.total").value("85.93"))
        .andExpect(jsonPath("$.balance.paid").value("10.00"))
        .andExpect(jsonPath("$.balance.status").value("PARTIAL"))
        .andExpect(jsonPath("$.revisions[0].snapshot.client.name").value("Cliente de prueba"))
        .andExpect(jsonPath("$.payments[0].amount").value("10.00"));
    for (String target : List.of("WORKING", "READY"))
      workflow.transition(
          id,
          parse(
              "{\"version\":"
                  + caseRepository.caseRow(id).get("version")
                  + ",\"status\":\""
                  + target
                  + "\",\"reason\":\"Avance\"}"));
    mvc.perform(get("/api/dashboard").header("Host", "localhost:8081"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.pendingCases").value(0));
    mvc.perform(get("/api/cases").header("Host", "localhost:8081").param("status", "OPEN"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$").isEmpty());
    mvc.perform(
            post("/api/cases/" + id + "/payments")
                .header("Host", "localhost:8081")
                .header("X-Scalaris-Request", "1")
                .contentType("application/json")
                .content(encode(payment("1000"))))
        .andExpect(status().isBadRequest())
        .andExpect(
            jsonPath("$.message").value("El importe debe ser positivo y no superar el saldo."));
    assertThat(paymentRepository.paid(id)).isEqualByComparingTo("10.00");
  }

  @Test
  void failedRevisionEditRollsBackCaseNumberAndVersionChanges() {
    long id = createCase();
    var before = caseRepository.caseRow(id);
    assertThat(before.get("quote_number")).isNull();
    var request = RulesTest.quote().put("version", 0);
    // save allocates the case's quote number before discovering the missing revision.
    assertThatThrownBy(() -> quotes.save(id, Long.MAX_VALUE, request))
        .hasMessageContaining("Registro inexistente");
    var after = caseRepository.caseRow(id);
    assertThat(after.get("quote_number")).isNull();
    assertThat(after.get("version")).isEqualTo(before.get("version"));
    assertThat(s.rows("SELECT * FROM revisions WHERE case_id=?", id)).isEmpty();
    assertThat(s.rows("SELECT * FROM events WHERE case_id=?", id)).hasSize(1);
  }

  @Test
  void snapshotAndExactAcceptedRevisionRemainImmutable() throws Exception {
    long id = createCase();
    diagnosis(id);
    var r = send(id);
    var cl = s.one("SELECT * FROM clients WHERE id=?", caseRepository.caseRow(id).get("client_id"));
    clients.save(
        number(cl, "id"), parse("{\"name\":\"Renombrado\",\"version\":" + cl.get("version") + "}"));
    assertThat(
            ((com.fasterxml.jackson.databind.JsonNode) r.get("snapshot"))
                .path("client")
                .path("name")
                .asText())
        .isEqualTo("Cliente de prueba");
    assertThatThrownBy(() -> quotes.save(id, number(r, "id"), RulesTest.quote()))
        .isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
    var accepted = accept(id, r);
    assertThat(caseRepository.caseRow(id).get("accepted_revision_id"))
        .isEqualTo(accepted.get("id"));
    assertThat(s.one("SELECT * FROM work_orders WHERE case_id=?", id).get("revision_id"))
        .isEqualTo(accepted.get("id"));
    assertThatThrownBy(() -> jdbc.update("UPDATE revisions SET total=1 WHERE id=?", r.get("id")))
        .hasMessageContaining("congelada");
    var next = quotes.save(id, null, RulesTest.quote());
    assertThat(next.get("revision")).isEqualTo(2);
    assertThat(caseRepository.caseRow(id).get("accepted_revision_id")).isEqualTo(r.get("id"));
    try (var document = org.apache.pdfbox.Loader.loadPDF(pdf.create(accepted))) {
      String text = new org.apache.pdfbox.text.PDFTextStripper().getText(document);
      assertThat(text).contains("Cliente de prueba", "PRESUPUESTO", "85,93");
      assertThat(text).doesNotContain("Renombrado", "garantía");
    }
  }

  @Test
  void workflowEnforcesAcceptanceAndReason() {
    long id = createCase();
    assertThatThrownBy(
            () ->
                workflow.transition(
                    id, parse("{\"version\":0,\"status\":\"ACCEPTED\",\"reason\":\"test\"}")))
        .hasMessageContaining("revisión");
    assertThatThrownBy(() -> send(id)).hasMessageContaining("diagnóstico");
    diagnosis(id);
    var r = send(id);
    assertThatThrownBy(
            () ->
                workflow.transition(
                    id,
                    parse(
                        "{\"version\":"
                            + caseRepository.caseRow(id).get("version")
                            + ",\"status\":\"WORKING\",\"reason\":\"test\"}")))
        .hasMessageContaining("incoherente");
    accept(id, r);
    workflow.transition(
        id,
        parse(
            "{\"version\":"
                + caseRepository.caseRow(id).get("version")
                + ",\"status\":\"WORKING\",\"reason\":\"Iniciamos\"}"));
    assertThat(caseRepository.caseRow(id).get("status")).isEqualTo("WORKING");
  }

  @Test
  void optimisticConcurrencyPreventsOverwrite() {
    long id = createCase();
    var n =
        parse(
            "{\"clientId\":"
                + caseRepository.caseRow(id).get("client_id")
                + ",\"version\":0,\"data\":{\"title\":\"A\"}}");
    workflow.editCase(id, n);
    assertThatThrownBy(() -> workflow.editCase(id, n)).hasMessageContaining("Otro dispositivo");
    assertThat(data(caseRepository.caseRow(id)).path("title").asText()).isEqualTo("A");
  }

  @Test
  void paymentsAreIndependentDuplicateProtectedAndTraceable() {
    long id = createCase();
    diagnosis(id);
    accept(id, send(id));
    var p = payment("10");
    payments.pay(id, p);
    assertThat(paymentRepository.account(id).status()).isEqualTo("PARTIAL");
    assertThat(caseRepository.caseRow(id).get("status")).isEqualTo("ACCEPTED");
    assertThatThrownBy(() -> payments.pay(id, p)).hasMessageContaining("registrada");
    assertThatThrownBy(() -> payments.pay(id, payment("1000"))).hasMessageContaining("saldo");
    assertThatThrownBy(() -> payments.pay(id, payment("10"))).hasMessageContaining("duplicado");
    long pid = number(s.one("SELECT * FROM payments WHERE case_id=?", id), "id");
    payments.reverse(id, pid, parse("{\"reason\":\"Corrección\"}"));
    assertThat(paymentRepository.paid(id)).isEqualByComparingTo("0");
    assertThatThrownBy(() -> payments.reverse(id, pid, parse("{\"reason\":\"Otra\"}")))
        .hasMessageContaining("otra");
    assertThatThrownBy(() -> jdbc.update("DELETE FROM payments WHERE id=?", pid))
        .hasMessageContaining("inmutable");
    assertThat(s.rows("SELECT * FROM events WHERE case_id=? AND type='REVERSAL'", id)).hasSize(1);
  }

  @Test
  void parallelPaymentsCannotExceedBalance() throws Exception {
    long id = createCase();
    diagnosis(id);
    accept(id, send(id));
    try (var exec = Executors.newFixedThreadPool(2)) {
      var futures = new ArrayList<Future<Boolean>>();
      for (int i = 0; i < 2; i++)
        futures.add(
            exec.submit(
                () -> {
                  try {
                    payments.pay(id, payment("60"));
                    return true;
                  } catch (org.springframework.web.server.ResponseStatusException
                      | BusinessRuleException e) {
                    return false;
                  }
                }));
      int count = 0;
      for (var f : futures) if (f.get()) count++;
      assertThat(count).isEqualTo(1);
      assertThat(paymentRepository.paid(id)).isEqualByComparingTo("60");
    }
  }

  @Test
  void parallelRevisionNumbersAreUnique() throws Exception {
    long id = createCase();
    try (var exec = Executors.newFixedThreadPool(4)) {
      var jobs = new ArrayList<Future<Map<String, Object>>>();
      for (int i = 0; i < 4; i++)
        jobs.add(exec.submit(() -> quotes.save(id, null, RulesTest.quote())));
      var numbers = new HashSet<Object>();
      for (var f : jobs) numbers.add(f.get().get("revision"));
      assertThat(numbers).hasSize(4);
      assertThat(caseRepository.caseRow(id).get("quote_number")).isNotNull();
    }
  }

  ObjectNode inquiry() {
    return (ObjectNode)
        parse(
            "{\"schema\":\"scalaris.inquiry\",\"version\":1,\"id\":\""
                + UUID.randomUUID()
                + "\",\"createdAt\":\"2026-10-03T12:00:00-03:00\",\"service\":\"SOFTWARE\",\"contact\":{\"name\":\"Nuevo\"},\"answers\":{\"need\":\"Sitio"
                + " web\"}}");
  }

  @Test
  void importPreviewHostileAndDuplicate() {
    var n = inquiry();
    assertThat(imports.preview(n).get("duplicates")).asList().isEmpty();
    var request = JSON.createObjectNode();
    request.set("inquiry", n);
    imports.confirm(request);
    assertThat(imports.preview(n).get("duplicates")).asList().hasSize(1);
    assertThatThrownBy(() -> imports.confirm(request)).hasMessageContaining("importada");
    n.put("id", UUID.randomUUID().toString());
    assertThat(imports.preview(n).get("duplicates")).asList().hasSize(1);
    n.put("password", "bad");
    assertThatThrownBy(() -> imports.preview(n)).hasMessageContaining("no admitido");
    n.remove("password");
    ((ObjectNode) n.get("answers")).put("need", "x".repeat(33000));
    assertThatThrownBy(() -> imports.preview(n)).hasMessageContaining("32 KB");
  }

  @Test
  void securityRejectsUnexpectedOriginHostAndMissingHeader() throws Exception {
    mvc.perform(get("/api/health").header("Host", "evil.test")).andExpect(status().isForbidden());
    mvc.perform(
            get("/api/health")
                .header("Host", "localhost:8081")
                .header("Sec-Fetch-Site", "cross-site"))
        .andExpect(status().isForbidden());
    mvc.perform(
            post("/api/clients")
                .header("Host", "localhost:8081")
                .contentType("application/json")
                .content("{\"name\":\"X\"}"))
        .andExpect(status().isForbidden());
    mvc.perform(
            post("/api/clients")
                .header("Host", "localhost:8081")
                .header("X-Scalaris-Request", "1")
                .header("Origin", "https://evil.test")
                .contentType("application/json")
                .content("{\"name\":\"X\"}"))
        .andExpect(status().isForbidden());
    mvc.perform(get("/api/health").header("Host", "localhost:8081")).andExpect(status().isOk());
  }

  @Test
  void filesAreOutsideRepoAndLimited() throws Exception {
    long id = createCase();
    var file =
        new org.springframework.mock.web.MockMultipartFile(
            "file", "../safe.txt", "text/plain", "Notas".getBytes());
    var saved = files.upload(id, file);
    assertThat(saved.get("original_name").toString()).doesNotContain("/");
    assertThat(files.read(saved)).isEqualTo("Notas".getBytes());
    for (int i = 1; i < 20; i++) files.upload(id, file);
    assertThatThrownBy(() -> files.upload(id, file)).hasMessageContaining("20");
  }

  @Test
  void attachmentRollbackRemovesOnlyItsNewFileAndMetadata() throws Exception {
    long caseId = createCase();
    Set<Path> before;
    try (var paths = java.nio.file.Files.list(storage.root())) {
      before = new HashSet<>(paths.toList());
    }
    jdbc.execute(
        "ALTER TABLE events ADD CONSTRAINT scalaris_test_reject_attachment"
            + " CHECK(type<>'ATTACHED')");
    try {
      var file =
          new org.springframework.mock.web.MockMultipartFile(
              "file",
              "rollback.txt",
              "text/plain",
              "Notas descartables".getBytes(java.nio.charset.StandardCharsets.UTF_8));
      assertThatThrownBy(() -> files.upload(caseId, file))
          .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
      assertThat(
              jdbc.queryForObject(
                  "SELECT count(*) FROM attachments WHERE case_id=?", Integer.class, caseId))
          .isZero();
      try (var paths = java.nio.file.Files.list(storage.root())) {
        assertThat(new HashSet<>(paths.toList())).isEqualTo(before);
      }
    } finally {
      jdbc.execute("ALTER TABLE events DROP CONSTRAINT scalaris_test_reject_attachment");
    }
  }

  @Test
  void auditIsAppendOnlyAndSeedEditable() {
    long id = createCase();
    assertThat(s.rows("SELECT * FROM events WHERE case_id=?", id)).hasSize(1);
    assertThatThrownBy(() -> jdbc.update("DELETE FROM events WHERE case_id=?", id))
        .hasMessageContaining("inmutable");
    assertThat(jdbc.queryForObject("SELECT count(*) FROM catalog", Integer.class)).isEqualTo(29);
    var c = s.one("SELECT * FROM catalog WHERE seed_key='vidainformatica-1'");
    var n = JSON.createObjectNode();
    n.put("description", c.get("description").toString());
    n.put("kind", "LABOR");
    n.put("unit", "servicio");
    n.put("price", "12000");
    n.put("active", false);
    n.put("version", number(c, "version"));
    catalog.save(number(c, "id"), n);
    assertThat(s.one("SELECT * FROM catalog WHERE id=?", c.get("id")).get("price"))
        .isEqualTo("12000.00");
  }

  @Test
  void newAcceptanceExplicitlyChangesOrderWithoutChangingOldContract() {
    long id = createCase();
    diagnosis(id);
    var old = accept(id, send(id));
    var next = send(id);
    assertThat(caseRepository.caseRow(id).get("accepted_revision_id")).isEqualTo(old.get("id"));
    accept(id, next);
    assertThat(caseRepository.caseRow(id).get("accepted_revision_id")).isEqualTo(next.get("id"));
    assertThat(s.one("SELECT * FROM revisions WHERE id=?", old.get("id")).get("status"))
        .isEqualTo("ACCEPTED");
    assertThat(s.rows("SELECT * FROM events WHERE case_id=? AND type='ACCEPTED'", id)).hasSize(2);
  }

  @Test
  void deliveryDoesNotRequireDepositAndCorrectionRequiresReason() {
    long id = createCase();
    diagnosis(id);
    accept(id, send(id));
    for (String to : List.of("WORKING", "READY"))
      workflow.transition(
          id,
          parse(
              "{\"status\":\""
                  + to
                  + "\",\"version\":"
                  + caseRepository.caseRow(id).get("version")
                  + ",\"reason\":\"Avance\"}"));
    assertThatThrownBy(
            () ->
                workflow.transition(
                    id,
                    parse(
                        "{\"status\":\"DELIVERED\",\"version\":"
                            + caseRepository.caseRow(id).get("version")
                            + ",\"reason\":\"Entrega\"}")))
        .hasMessageContaining("entrega");
    workflow.work(
        id, parse("{\"tasks\":[],\"actualHours\":\"8\",\"delivery\":\"Entregado\",\"version\":0}"));
    workflow.transition(
        id,
        parse(
            "{\"status\":\"DELIVERED\",\"version\":"
                + caseRepository.caseRow(id).get("version")
                + ",\"reason\":\"Entrega\"}"));
    assertThat(paymentRepository.account(id).status()).isEqualTo("UNPAID");
    assertThatThrownBy(
            () ->
                workflow.transition(
                    id,
                    parse(
                        "{\"status\":\"WORKING\",\"version\":"
                            + caseRepository.caseRow(id).get("version")
                            + ",\"correction\":true,\"reason\":\"\"}")))
        .hasMessageContaining("longitud");
    workflow.transition(
        id,
        parse(
            "{\"status\":\"WORKING\",\"version\":"
                + caseRepository.caseRow(id).get("version")
                + ",\"correction\":true,\"reason\":\"Revisión posterior\"}"));
    assertThat(caseRepository.caseRow(id).get("status")).isEqualTo("WORKING");
    assertThat(s.rows("SELECT * FROM events WHERE type='REOPENED' AND case_id=?", id)).hasSize(1);
  }

  @Test
  void hostilePdfActionsAreRejected() throws Exception {
    try (var document = new org.apache.pdfbox.pdmodel.PDDocument();
        var out = new java.io.ByteArrayOutputStream()) {
      document.addPage(new org.apache.pdfbox.pdmodel.PDPage());
      document
          .getDocumentCatalog()
          .setOpenAction(
              new org.apache.pdfbox.pdmodel.interactive.action.PDActionJavaScript(
                  "app.alert('bad')"));
      document.save(out);
      assertThatThrownBy(() -> AttachmentValidator.validate(out.toByteArray(), "application/pdf"))
          .hasMessageContaining("acciones");
    }
  }

  @Test
  void duplicateJsonKeysAreRejectedAtHttpBoundary() throws Exception {
    mvc.perform(
            post("/api/clients")
                .header("Host", "localhost:8081")
                .header("X-Scalaris-Request", "1")
                .contentType("application/json")
                .content("{\"name\":\"first\",\"name\":\"second\"}"))
        .andExpect(status().isBadRequest());
    assertThat(s.rows("SELECT * FROM clients")).isEmpty();
  }

  @Test
  void concurrentImportsCreateExactlyOneClientAndCase() throws Exception {
    var req = JSON.createObjectNode();
    req.set("inquiry", inquiry());
    try (var exec = Executors.newFixedThreadPool(2)) {
      var results = new ArrayList<Future<Boolean>>();
      for (int i = 0; i < 2; i++)
        results.add(
            exec.submit(
                () -> {
                  try {
                    imports.confirm(req);
                    return true;
                  } catch (org.springframework.web.server.ResponseStatusException e) {
                    return false;
                  }
                }));
      int successes = 0;
      for (var result : results) if (result.get()) successes++;
      assertThat(successes).isEqualTo(1);
      assertThat(s.rows("SELECT * FROM clients")).hasSize(1);
      assertThat(s.rows("SELECT * FROM cases")).hasSize(1);
    }
  }

  @Test
  void seedCanRunAgainWithoutOverwritingUserPrice() throws Exception {
    var c = s.one("SELECT * FROM catalog WHERE seed_key='vidainformatica-1'");
    jdbc.update("UPDATE catalog SET price=13000,active=false WHERE id=?", c.get("id"));
    try (var source = getClass().getResourceAsStream("/db/migration/V2__editable_catalog.sql")) {
      jdbc.execute(
          new String(
              java.util.Objects.requireNonNull(source).readAllBytes(),
              java.nio.charset.StandardCharsets.UTF_8));
    }
    assertThat(s.one("SELECT * FROM catalog WHERE id=?", c.get("id")).get("price"))
        .isEqualTo("13000.00");
    assertThat(jdbc.queryForObject("SELECT count(*) FROM catalog", Integer.class)).isEqualTo(29);
  }

  @Test
  void manualAcceptanceDateCanPrecedeItsRegistration() {
    long id = createCase();
    diagnosis(id);
    var r = send(id);
    var n = JSON.createObjectNode();
    n.put("version", number(r, "version"));
    n.put("date", "2026-10-02T15:00:00-03:00");
    n.put("channel", "Presencial");
    n.put("note", "Se registra hoy una aceptación informada de ayer");
    var accepted = quotes.accept(id, number(r, "id"), n);
    assertThat(accepted.get("accepted_at")).isEqualTo("2026-10-02T18:00:00Z");
    assertThat(Instant.parse(accepted.get("sent_at").toString()))
        .isAfter(Instant.parse(accepted.get("accepted_at").toString()));
  }
}
