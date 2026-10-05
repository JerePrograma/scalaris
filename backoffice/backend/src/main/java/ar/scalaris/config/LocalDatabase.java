package ar.scalaris.config;

import org.springframework.beans.factory.config.BeanFactoryPostProcessor;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

@Configuration
public class LocalDatabase {
  private static final java.util.regex.Pattern URL = java.util.regex.Pattern.compile(
      "jdbc:postgresql://(127\\.0\\.0\\.1|localhost|\\[::1\\]):(\\d{1,5})/([a-zA-Z][a-zA-Z0-9_]*)");

  record Destination(String database, int port) {}
  record Identity(String database, int versionNumber, String address, int port,
                  String listen, String schema, String user) {}

  static Destination destination(String url) {
    var match = URL.matcher(java.util.Objects.toString(url, ""));
    if (!match.matches())
      throw new IllegalStateException(
          "URL PostgreSQL debe usar loopback local, puerto explícito, una sola base y sin parámetros adicionales.");
    int port = Integer.parseInt(match.group(2));
    String database = match.group(3);
    if (port < 1 || port > 65535 || port == 5432)
      throw new IllegalStateException("Puerto PostgreSQL inválido o reservado para Molineros (5432).");
    if (!database.matches("scalaris_test_[a-zA-Z0-9_]+") && port != 5433)
      throw new IllegalStateException("La base de Scalaris debe usar PostgreSQL en 5433.");
    return new Destination(database, port);
  }

  public static void validateUrl(String url) {
    destination(url);
  }

  static void validateIdentity(String url, String expectedUser, Identity identity) {
    var expected = destination(url);
    if (!expected.database().equals(identity.database()) || expected.port() != identity.port())
      throw new IllegalStateException("La identidad de PostgreSQL no coincide con la base y puerto configurados.");
    if (identity.versionNumber() / 10000 != 18)
      throw new IllegalStateException("Scalaris requiere PostgreSQL 18; no se ejecutarán migraciones.");
    if (!"public".equals(identity.schema()) || !java.util.Objects.equals(expectedUser, identity.user()))
      throw new IllegalStateException("El esquema o usuario PostgreSQL no coincide con el destino autorizado.");
    if (!java.util.Set.of("127.0.0.1", "::1").contains(identity.address()))
      throw new IllegalStateException("PostgreSQL debe ser local.");
    for (String host : identity.listen().split(","))
      if (!java.util.Set.of("localhost", "127.0.0.1", "::1").contains(host.strip()))
        throw new IllegalStateException("PostgreSQL debe escuchar solo en loopback antes de iniciar Scalaris.");
  }

  static void applyStartupPolicy(org.flywaydb.core.Flyway flyway, String database) {
    if (database.matches("scalaris_test_[a-zA-Z0-9_]+")) {
      flyway.migrate();
      return;
    }
    try {
      flyway.validate();
    } catch (org.flywaydb.core.api.FlywayException e) {
      throw new IllegalStateException(
          "Validación Flyway falló. Revisá el historial; ejecutá scripts/Migrate.ps1 para migraciones pendientes con respaldo. El arranque no modifica el esquema.", e);
    }
    if (flyway.info().pending().length > 0)
      throw new IllegalStateException(
          "Hay migraciones pendientes. Ejecutá scripts/Migrate.ps1 con respaldo antes de iniciar Scalaris.");
  }

  @Bean
  static BeanFactoryPostProcessor validateBeforeConnection(Environment environment) {
    return factory -> {
      validateUrl(environment.getProperty("spring.datasource.url"));
      validatePassword(environment.getProperty("spring.datasource.password"));
    };
  }

  static void validatePassword(String password) {
    if (password == null || password.isEmpty())
      throw new IllegalStateException("Falta la contraseña de PostgreSQL. Usá SCALARIS_DB_PASSWORD en el entorno del proceso o Start-IntelliJ.ps1 con la credencial DPAPI existente; no la incluyas en argumentos ni archivos versionados.");
  }

  @Bean
  FlywayMigrationStrategy verifyBeforeMigration(Environment environment) {
    return flyway -> {
      Identity identity;
      try (var connection = flyway.getConfiguration().getDataSource().getConnection();
          var statement = connection.createStatement();
          var result =
              statement.executeQuery(
                  "SELECT current_database(),current_setting('server_version_num')::int,"
                      + "host(inet_server_addr()),inet_server_port(),current_setting('listen_addresses'),"
                      + "current_schema(),current_user")) {
        result.next();
        identity = new Identity(result.getString(1), result.getInt(2), result.getString(3),
            result.getInt(4), result.getString(5), result.getString(6), result.getString(7));
      } catch (java.sql.SQLException e) {
        throw new IllegalStateException("No se pudo verificar PostgreSQL local.", e);
      }
      validateIdentity(environment.getProperty("spring.datasource.url"),
          environment.getProperty("spring.datasource.username"), identity);
      if (java.util.Arrays.stream(flyway.getConfiguration().getSchemas()).anyMatch(schema -> !schema.equals("public")))
        throw new IllegalStateException("Flyway solo puede migrar el esquema public autorizado.");
      String defaultSchema = flyway.getConfiguration().getDefaultSchema();
      if (defaultSchema != null && !defaultSchema.equals("public"))
        throw new IllegalStateException("El esquema predeterminado Flyway debe ser public.");
      applyStartupPolicy(flyway, identity.database());
    };
  }
}
