package ar.scalaris.config;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import org.junit.jupiter.api.Test;

class DatabaseGuardTest {
  @Test
  void missingCredentialFailsBeforeOpeningConnectionWithoutShowingItsValue() {
    assertThatThrownBy(() -> LocalDatabase.validatePassword(null)).hasMessageContaining("SCALARIS_DB_PASSWORD");
    assertThatThrownBy(() -> LocalDatabase.validatePassword("")).hasMessageContaining("Start-IntelliJ.ps1");
    assertThatCode(() -> LocalDatabase.validatePassword("test-only-not-a-credential")).doesNotThrowAnyException();
  }
  private final String url = "jdbc:postgresql://127.0.0.1:5433/scalaris";
  private LocalDatabase.Identity identity(String database, int version, int port, String schema, String user) {
    return new LocalDatabase.Identity(database, version, "127.0.0.1", port, "localhost", schema, user);
  }

  @Test
  void verifiesExactDatabasePortVersionSchemaAndUserBeforeMigrate() {
    assertThatCode(() -> LocalDatabase.validateIdentity(url, "postgres", identity("scalaris", 180006, 5433, "public", "postgres"))).doesNotThrowAnyException();
    assertThatThrownBy(() -> LocalDatabase.validateIdentity(url, "postgres", identity("other", 180006, 5433, "public", "postgres"))).hasMessageContaining("identidad");
    assertThatThrownBy(() -> LocalDatabase.validateIdentity(url, "postgres", identity("scalaris", 180006, 5432, "public", "postgres"))).hasMessageContaining("identidad");
    assertThatThrownBy(() -> LocalDatabase.validateIdentity(url, "postgres", identity("scalaris", 90600, 5433, "public", "postgres"))).hasMessageContaining("PostgreSQL 18");
    assertThatThrownBy(() -> LocalDatabase.validateIdentity(url, "postgres", identity("scalaris", 180006, 5433, "private", "postgres"))).hasMessageContaining("esquema o usuario");
    assertThatThrownBy(() -> LocalDatabase.validateIdentity(url, "postgres", identity("scalaris", 180006, 5433, "public", "other"))).hasMessageContaining("esquema o usuario");
    assertThatThrownBy(() -> LocalDatabase.validateIdentity(url, "postgres", new LocalDatabase.Identity("scalaris", 180006, "192.168.1.10", 5433, "localhost", "public", "postgres"))).hasMessageContaining("local");
    assertThatThrownBy(() -> LocalDatabase.validateIdentity(url, "postgres", new LocalDatabase.Identity("scalaris", 180006, "127.0.0.1", 5433, "*", "public", "postgres"))).hasMessageContaining("loopback");
  }

  @Test
  void realAndRestoreDatabasesOnlyValidateOnStartupWhileDisposableTestsMayMigrate() {
    var flyway = mock(org.flywaydb.core.Flyway.class);
    var info = mock(org.flywaydb.core.api.MigrationInfoService.class);
    when(flyway.info()).thenReturn(info);
    when(info.pending()).thenReturn(new org.flywaydb.core.api.MigrationInfo[0]);
    LocalDatabase.applyStartupPolicy(flyway, "scalaris");
    LocalDatabase.applyStartupPolicy(flyway, "scalaris_restore_20261004");
    verify(flyway, times(2)).validate();
    verify(flyway, never()).migrate();
    when(info.pending()).thenReturn(new org.flywaydb.core.api.MigrationInfo[] { mock(org.flywaydb.core.api.MigrationInfo.class) });
    assertThatThrownBy(() -> LocalDatabase.applyStartupPolicy(flyway, "scalaris"))
        .hasMessageContaining("Migrate.ps1");
    verify(flyway, never()).migrate();
    LocalDatabase.applyStartupPolicy(flyway, "scalaris_test_jdk25_20261004");
    verify(flyway).migrate();
  }
}
