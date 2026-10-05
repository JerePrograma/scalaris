package ar.scalaris.config;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.servlet.FilterChain;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class OriginGuardTest {
  private static final String LOCAL = "http://localhost:8081,http://127.0.0.1:8081";
  private static final String VITE = LOCAL + ",http://localhost:5173,http://127.0.0.1:5173";

  private static MockHttpServletRequest request(String method, String host) {
    var request = new MockHttpServletRequest(method, "/api/health");
    request.setScheme("http");
    request.addHeader("Host", host);
    request.addHeader("Sec-Fetch-Site", "same-origin");
    return request;
  }

  private static MockHttpServletResponse filter(
      String origins, MockHttpServletRequest request, AtomicBoolean reached) throws Exception {
    var response = new MockHttpServletResponse();
    FilterChain chain = (ignoredRequest, ignoredResponse) -> reached.set(true);
    new OriginGuard(origins).doFilter(request, response, chain);
    return response;
  }

  @Test
  void localModeRejectsViteWithIntactUtf8Message() throws Exception {
    var reached = new AtomicBoolean();
    var response = filter(LOCAL, request("GET", "127.0.0.1:5173"), reached);
    assertThat(reached).isFalse();
    assertThat(response.getStatus()).isEqualTo(403);
    assertThat(response.getCharacterEncoding()).isEqualTo("UTF-8");
    assertThat(new String(response.getContentAsByteArray(), StandardCharsets.UTF_8))
        .contains("Abrí la aplicación en una dirección configurada.");
  }

  @Test
  void explicitViteConfigurationAllowsBothLocalHostsAndSameOriginMutations() throws Exception {
    for (String host : new String[] {"127.0.0.1:5173", "localhost:5173"}) {
      for (String method : new String[] {"GET", "POST"}) {
        var request = request(method, host);
        request.addHeader("Origin", "http://" + host);
        request.addHeader("X-Scalaris-Request", "1");
        request.setContentType("application/json");
        request.setContent("{}".getBytes(StandardCharsets.UTF_8));
        var reached = new AtomicBoolean();
        var response = filter(VITE, request, reached);
        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(reached).isTrue();
      }
    }
  }

  @Test
  void viteModeStillRejectsForeignHostsOriginsCrossSiteAndMissingMutationHeader() throws Exception {
    var foreignHost = request("GET", "example.invalid:5173");
    var foreignOrigin = request("GET", "127.0.0.1:5173");
    foreignOrigin.addHeader("Origin", "http://example.invalid");
    var crossSite = request("GET", "127.0.0.1:5173");
    crossSite.removeHeader("Sec-Fetch-Site");
    crossSite.addHeader("Sec-Fetch-Site", "cross-site");
    var missingHeader = request("POST", "127.0.0.1:5173");
    var mismatchedOrigin = request("POST", "127.0.0.1:5173");
    mismatchedOrigin.addHeader("Origin", "http://localhost:5173");
    mismatchedOrigin.addHeader("X-Scalaris-Request", "1");
    for (var request : new MockHttpServletRequest[] {
      foreignHost, foreignOrigin, crossSite, missingHeader, mismatchedOrigin
    }) {
      var reached = new AtomicBoolean();
      assertThat(filter(VITE, request, reached).getStatus()).isEqualTo(403);
      assertThat(reached).isFalse();
    }
  }

  @Test
  void oversizedJsonRemainsRejectedBeforeCallingApplication() throws Exception {
    var request = request("POST", "127.0.0.1:5173");
    request.addHeader("Origin", "http://127.0.0.1:5173");
    request.addHeader("X-Scalaris-Request", "1");
    request.setContentType("application/json");
    request.setContent(new byte[262145]);
    var reached = new AtomicBoolean();
    var response = filter(VITE, request, reached);
    assertThat(response.getStatus()).isEqualTo(413);
    assertThat(response.getCharacterEncoding()).isEqualTo("UTF-8");
    assertThat(reached).isFalse();
  }
}
