package ar.scalaris;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import ar.scalaris.controller.*;
import ar.scalaris.domain.Account;
import ar.scalaris.dto.request.RequestInput;
import ar.scalaris.repository.jdbc.BackofficeRepository;
import ar.scalaris.service.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class ApiContractTest {
  @Test
  void readContractsAndBinaryHeadersRemainStable() throws Exception {
    var repository = mock(BackofficeRepository.class);
    when(repository.checkConnection()).thenReturn(1);
    var client =
        Map.<String, Object>of(
            "id", 1L, "version", 0L, "data", RequestInput.parse("{\"name\":\"Cliente\"}"));
    when(repository.clients(anyString())).thenReturn(List.of(client));
    when(repository.caseRow(7L)).thenReturn(Map.of("client_id", 1L, "id", 7L));
    when(repository.client(1L)).thenReturn(client);
    when(repository.revisions(7L)).thenReturn(List.of(client));
    when(repository.events(7L)).thenReturn(List.of(client));
    when(repository.account(7L))
        .thenReturn(
            new Account(new java.math.BigDecimal("85.93"), java.math.BigDecimal.ZERO, true));
    var quotes = mock(Quotes.class);
    when(quotes.pdf(4L)).thenReturn("pdf bytes".getBytes());
    var mvc =
        MockMvcBuilders.standaloneSetup(
                new ReadController(new BackofficeQueries(repository)),
                new ClientController(mock(Clients.class)),
                new CatalogController(mock(Catalog.class)),
                new CaseController(mock(Workflow.class)),
                new QuoteController(quotes),
                new PaymentController(mock(Payments.class)),
                new ImportController(mock(PublicImport.class)),
                new AttachmentController(mock(AttachmentService.class)))
            .setControllerAdvice(new Errors())
            .build();
    mvc.perform(get("/api/health"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.database").value(1))
        .andExpect(jsonPath("$.timezone").value("America/Argentina/Buenos_Aires"));
    mvc.perform(get("/api/clients"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].data.name").value("Cliente"));
    mvc.perform(get("/api/cases/7"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.case.id").value(7))
        .andExpect(jsonPath("$.client.data.name").value("Cliente"))
        .andExpect(jsonPath("$.balance.status").value("UNPAID"))
        .andExpect(jsonPath("$.revisions[0].id").value(1))
        .andExpect(jsonPath("$.events[0].id").value(1));
    mvc.perform(get("/api/revisions/4/pdf"))
        .andExpect(status().isOk())
        .andExpect(header().string("Content-Disposition", "attachment; filename=presupuesto-4.pdf"))
        .andExpect(content().contentType("application/pdf"))
        .andExpect(content().bytes("pdf bytes".getBytes()));
    mvc.perform(get("/api/clients").param("q", "x".repeat(301))).andExpect(status().isBadRequest());
    mvc.perform(get("/api/cases").param("offset", "-1")).andExpect(status().isBadRequest());
    mvc.perform(get("/api/audit").param("offset", "-1")).andExpect(status().isBadRequest());
  }
}
