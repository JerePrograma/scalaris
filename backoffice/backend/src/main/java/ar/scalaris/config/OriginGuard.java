package ar.scalaris.config;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Same-origin browser barrier and Host allowlist. This does not provide authentication. */
@Component
public class OriginGuard extends OncePerRequestFilter {
  private static final Logger LOG = LoggerFactory.getLogger(OriginGuard.class);
  final Set<String> origins;
  final Set<String> hosts;

  public OriginGuard(@Value("${scalaris.allowed-origins}") String config) {
    origins = new HashSet<>();
    hosts = new HashSet<>();
    for (String s : config.split(",")) {
      String value = s.strip();
      URI uri = URI.create(value);
      if (!Set.of("http", "https").contains(uri.getScheme())
          || uri.getHost() == null
          || uri.getRawUserInfo() != null
          || uri.getRawQuery() != null
          || uri.getRawFragment() != null
          || !(uri.getPath() == null || uri.getPath().isEmpty()))
        throw new IllegalArgumentException("Origen inválido: " + value);
      origins.add(value);
      hosts.add(uri.getRawAuthority().toLowerCase(Locale.ROOT));
    }
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; img-src 'self' blob:; style-src 'self'; font-src 'self'; script-src"
            + " 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action"
            + " 'self'");
    response.setHeader("Cache-Control", "no-store");
    String host = Objects.toString(request.getHeader("Host"), "").toLowerCase(Locale.ROOT),
        origin = request.getHeader("Origin"),
        fetch = request.getHeader("Sec-Fetch-Site");
    boolean mutation = !Set.of("GET", "HEAD").contains(request.getMethod());
    // Opt-in diagnostics for a data-free GET only. Never log bodies, query strings or clients.
    if (LOG.isDebugEnabled()
        && "GET".equals(request.getMethod())
        && "/api/health".equals(request.getRequestURI())) {
      LOG.debug("Health guard: host={} origin={} fetch={} hostAllowed={} originAllowed={}",
          diagnosticHeader(host, hosts), diagnosticHeader(origin, origins),
          Set.of("same-origin", "same-site", "cross-site", "none").contains(
              Objects.toString(fetch, "")) ? fetch : "absent/invalid",
          hosts.contains(host), origin == null || origins.contains(origin));
    }
    if (!hosts.contains(host)
        || "cross-site".equals(fetch)
        || (origin != null && !origins.contains(origin))
        || (mutation
            && (!"1".equals(request.getHeader("X-Scalaris-Request"))
                || origin != null && !origin.equals(request.getScheme() + "://" + host)))) {
      response.setStatus(403);
      response.setCharacterEncoding(StandardCharsets.UTF_8.name());
      response.setContentType("application/json");
      response
          .getWriter()
          .write(
              "{\"message\":\"Origen no autorizado. Abrí la aplicación en una dirección"
                  + " configurada.\"}");
      return;
    }
    if (mutation
        && request.getContentType() != null
        && request.getContentType().startsWith("application/json")
        && (request.getContentLengthLong() < 0 || request.getContentLengthLong() > 262144)) {
      response.setStatus(413);
      response.setCharacterEncoding(StandardCharsets.UTF_8.name());
      response.setContentType("application/json");
      response
          .getWriter()
          .write("{\"message\":\"JSON debe tener longitud fija y no superar 256 KB.\"}");
      return;
    }
    chain.doFilter(request, response);
  }

  private static String diagnosticHeader(String value, Set<String> configured) {
    if (value == null) return "absent";
    if (configured.contains(value)
        || value.matches("(?:http://)?(?:localhost|127\\.0\\.0\\.1):[0-9]{1,5}")) return value;
    return "untrusted/redacted";
  }
}
