package ar.scalaris.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.util.Properties;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.web.ServerProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;

class HttpEncodingTest {
  @Configuration(proxyBeanMethods = false)
  @EnableConfigurationProperties(ServerProperties.class)
  static class EncodingConfiguration {}

  @Test
  void shippedPropertiesBindForcedUtf8UsingSpringBootSupportedPrefix() throws Exception {
    var properties = new Properties();
    try (var input = getClass().getResourceAsStream("/application.properties")) {
      properties.load(input);
    }
    var encodingProperties = properties.stringPropertyNames().stream()
        .filter(name -> name.startsWith("server.servlet.encoding."))
        .map(name -> name + "=" + properties.getProperty(name))
        .toArray(String[]::new);
    assertThat(encodingProperties).hasSize(3);
    new ApplicationContextRunner()
        .withUserConfiguration(EncodingConfiguration.class)
        .withPropertyValues(encodingProperties)
        .run(context -> {
          var encoding = context.getBean(ServerProperties.class).getServlet().getEncoding();
          assertThat(encoding.getCharset()).isEqualTo(StandardCharsets.UTF_8);
          assertThat(encoding.isForce()).isTrue();
        });
  }
}
