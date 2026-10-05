package ar.scalaris.storage;

import static org.assertj.core.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;

@Timeout(40)
class StorageLockTest {
  @TempDir Path temp;

  @Test
  void markerIsNotALockAndCloseIsIdempotent() throws Exception {
    var marker = temp.resolve(".scalaris.lock");
    Files.writeString(marker, "Existing marker; no operating-system owner.");
    var first = new StorageLock(temp.toString());
    first.close();
    first.close();
    try (var restarted = new StorageLock(temp.toString())) {
      assertThat(restarted.root()).isEqualTo(temp.toAbsolutePath().normalize());
    }
    // Windows enforces the owner's byte-range lock even for a read in this JVM.
    assertThat(Files.readString(marker)).isEqualTo("Existing marker; no operating-system owner.");
  }

  @Test
  void overlappingFailureClosesOnlyItsOwnChannel() throws Exception {
    try (var first = new StorageLock(temp.toString())) {
      assertThatThrownBy(() -> new StorageLock(temp.toString()))
          .isInstanceOf(IllegalStateException.class)
          .hasMessageContaining("PID " + ProcessHandle.current().pid())
          .hasMessageContaining(temp.resolve(".scalaris.lock").toString());
      var probe = javaProcess("probe");
      try {
        assertThat(firstLine(probe)).startsWith("REJECTED");
        assertThat(probe.waitFor(10, TimeUnit.SECONDS)).isTrue();
        assertThat(probe.exitValue()).isEqualTo(3);
      } finally {
        finish(probe);
      }
    }
    // A leaked channel after OverlappingFileLockException would make FileShare.None fail on Windows.
    assumeTrue(isWindows());
    var backup = backupProcess("probe");
    try {
      assertThat(firstLine(backup)).isEqualTo("READY");
      assertThat(backup.waitFor(10, TimeUnit.SECONDS)).isTrue();
      assertThat(backup.exitValue()).isZero();
    } finally {
      finish(backup);
    }
  }

  @Test
  void independentJvmIsRejectedUntilOwnerStops() throws Exception {
    var owner = javaProcess("hold");
    try {
      assertThat(firstLine(owner)).isEqualTo("READY");
      assertThatThrownBy(() -> new StorageLock(temp.toString()))
          .hasMessageContaining("en uso por otra instancia o respaldo")
          .hasMessageContaining(temp.resolve(".scalaris.lock").toString());
    } finally {
      finish(owner);
    }
    try (var restarted = new StorageLock(temp.toString())) {
      assertThat(restarted.root()).isEqualTo(temp);
    }
  }

  @Test
  void springRefreshFailureReleasesPreviouslyInitializedLock() throws Exception {
    var context = new AnnotationConfigApplicationContext();
    context.registerBean(
        "storageLock", StorageLock.class,
        () -> {
          try {
            return new StorageLock(temp.toString());
          } catch (IOException e) {
            throw new UncheckedIOException(e);
          }
        });
    context.registerBean(
        "failingDependent", Object.class,
        () -> {
          context.getBean(StorageLock.class);
          throw new IllegalStateException("Disposable failure after storage initialization");
        });
    try {
      assertThatThrownBy(context::refresh).hasRootCauseMessage("Disposable failure after storage initialization");
      // refresh() itself must destroy the registered lock; close() has not yet been called.
      try (var restarted = new StorageLock(temp.toString())) {
        assertThat(restarted.root()).isEqualTo(temp);
      }
    } finally {
      context.close();
    }
  }

  @Test
  void unsuccessfulInitializationCanBeRetriedWithoutDeletingALockMarker() throws Exception {
    var marker = temp.resolve(".scalaris.lock");
    Files.createDirectory(marker);
    assertThatThrownBy(() -> new StorageLock(temp.toString()))
        .isInstanceOf(IOException.class)
        .hasMessageContaining(marker.toString());
    // This removes the deliberately invalid disposable directory, not a storage lock file.
    Files.delete(marker);
    try (var started = new StorageLock(temp.toString())) {
      assertThat(Files.isRegularFile(marker)).isTrue();
    }
  }

  @Test
  void relativeStorageIsRejectedBeforeAcquisition() {
    assertThatThrownBy(() -> new StorageLock("relative-storage-disallowed"))
        .hasMessageContaining("ruta absoluta");
  }

  @Test
  void appOwnershipPreventsBackupFileShareNone() throws Exception {
    assumeTrue(isWindows());
    try (var app = new StorageLock(temp.toString())) {
      var backup = backupProcess("probe");
      try {
        assertThat(firstLine(backup)).startsWith("REJECTED");
        assertThat(backup.waitFor(10, TimeUnit.SECONDS)).isTrue();
        assertThat(backup.exitValue()).isEqualTo(3);
      } finally {
        finish(backup);
      }
    }
  }

  @Test
  void backupOwnershipPreventsAppAndAppRestartsAfterRelease() throws Exception {
    assumeTrue(isWindows());
    var backup = backupProcess("hold");
    try {
      assertThat(firstLine(backup)).isEqualTo("READY");
      assertThatThrownBy(() -> new StorageLock(temp.toString()))
          .isInstanceOf(IOException.class)
          .hasMessageContaining(temp.resolve(".scalaris.lock").toString());
    } finally {
      finish(backup);
    }
    try (var started = new StorageLock(temp.toString())) {
      assertThat(started.root()).isEqualTo(temp);
    }
  }

  private static boolean isWindows() {
    return System.getProperty("os.name").startsWith("Windows");
  }

  private Process javaProcess(String mode) throws IOException {
    var java = Path.of(System.getProperty("java.home"), "bin", isWindows() ? "java.exe" : "java");
    var classpath = System.getProperty("surefire.test.class.path", System.getProperty("java.class.path"));
    return new ProcessBuilder(
            java.toString(), "-Dfile.encoding=UTF-8", "-cp", classpath,
            StorageLockProcess.class.getName(), temp.toString(), mode)
        .redirectErrorStream(true).start();
  }

  private Process backupProcess(String mode) throws IOException {
    var script = temp.resolve("backup-lock-helper.ps1");
    // Exactly the OpenOrCreate/ReadWrite/FileShare.None primitive used by Common.ps1 Lock-Storage.
    Files.writeString(
        script,
        """
        param([string]$LockPath,[string]$Mode)
        $ErrorActionPreference='Stop'
        try { $lock=[IO.File]::Open($LockPath,[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None) }
        catch { [Console]::WriteLine('REJECTED'); exit 3 }
        try {
          [Console]::WriteLine('READY')
          if($Mode -eq 'hold') { $null=[Console]::In.ReadLine() }
        } finally { $lock.Dispose() }
        """,
        StandardCharsets.UTF_8);
    return new ProcessBuilder(
            "powershell.exe", "-NoLogo", "-NoProfile", "-NonInteractive", "-File", script.toString(),
            "-LockPath", temp.resolve(".scalaris.lock").toString(), "-Mode", mode)
        .redirectErrorStream(true).start();
  }

  private static String firstLine(Process process) throws Exception {
    return CompletableFuture.supplyAsync(
            () -> {
              try {
                return process.inputReader(StandardCharsets.UTF_8).readLine();
              } catch (IOException e) {
                throw new UncheckedIOException(e);
              }
            })
        .get(15, TimeUnit.SECONDS);
  }

  private static void finish(Process process) throws Exception {
    try {
      process.outputWriter(StandardCharsets.UTF_8).write("STOP\n");
      process.outputWriter(StandardCharsets.UTF_8).flush();
    } catch (IOException ignored) {
      // A rejected probe exits before reading stdin.
    }
    if (!process.waitFor(10, TimeUnit.SECONDS)) {
      process.destroyForcibly();
      assertThat(process.waitFor(5, TimeUnit.SECONDS)).isTrue();
    }
  }
}
