package ar.scalaris.storage;

import jakarta.annotation.PreDestroy;
import java.io.IOException;
import java.nio.channels.FileChannel;
import java.nio.channels.FileLock;
import java.nio.channels.OverlappingFileLockException;
import java.nio.file.AccessDeniedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Owns one operating-system lock, shared with the backup scripts through .scalaris.lock. */
@Component
public final class StorageLock implements AutoCloseable {
  private final Path root;
  private final FileChannel channel;
  private final FileLock lock;

  public StorageLock(@Value("${scalaris.storage}") String storage) throws IOException {
    root = validateRoot(storage);
    var lease = acquire(root.resolve(".scalaris.lock"));
    channel = lease.channel();
    lock = lease.lock();
  }

  public Path root() {
    return root;
  }

  private static Path validateRoot(String storage) throws IOException {
    var configured = Path.of(storage);
    if (!configured.isAbsolute())
      throw new IllegalStateException(
          "scalaris.storage debe ser una ruta absoluta; configurá la misma ruta en scripts e IntelliJ.");
    var root = configured.normalize();
    // Check both the current checkout and the storage ancestors, including Git worktrees.
    for (Path parent = Path.of("").toAbsolutePath().normalize(); parent != null; parent = parent.getParent())
      if (Files.exists(parent.resolve(".git"))) {
        if (root.startsWith(parent))
          throw new IllegalStateException("Adjuntos deben estar fuera del repositorio: " + root);
        break;
      }
    for (Path parent = root; parent != null; parent = parent.getParent())
      if (Files.exists(parent.resolve(".git")))
        throw new IllegalStateException("Adjuntos deben estar fuera del repositorio: " + root);
    Files.createDirectories(root);
    if (!root.toRealPath().equals(root))
      throw new IllegalStateException("No usar enlaces simbólicos para adjuntos: " + root);
    return root;
  }

  private record Lease(FileChannel channel, FileLock lock) {}

  private static Lease acquire(Path path) throws IOException {
    FileChannel opened = null;
    try {
      opened = FileChannel.open(path, StandardOpenOption.CREATE, StandardOpenOption.WRITE);
      var acquired = opened.tryLock();
      if (acquired == null)
        throw new IllegalStateException(
            "Almacenamiento en uso por otra instancia o respaldo: "
                + path
                + ". Coordiná su detención limpia antes de reintentar; no borres el archivo de bloqueo.");
      return new Lease(opened, acquired);
    } catch (OverlappingFileLockException e) {
      var failure = new IllegalStateException(
          "Este proceso (PID "
              + ProcessHandle.current().pid()
              + ") ya mantiene un bloqueo de almacenamiento: "
              + path
              + ". Cerrá la instancia o contexto anterior antes de reintentar.", e);
      closeAfterFailedAcquisition(opened, failure);
      throw failure;
    } catch (AccessDeniedException e) {
      var failure = new IOException(
          "Acceso denegado al almacenamiento: "
              + path
              + ". Revisá permisos de la cuenta que ejecuta Scalaris.", e);
      closeAfterFailedAcquisition(opened, failure);
      throw failure;
    } catch (IOException e) {
      var failure = new IOException(
          "No se pudo abrir o bloquear el almacenamiento: "
              + path
              + ". Revisá el motivo de E/S y las instancias o respaldos activos antes de reintentar.", e);
      closeAfterFailedAcquisition(opened, failure);
      throw failure;
    } catch (RuntimeException | Error e) {
      closeAfterFailedAcquisition(opened, e);
      throw e;
    }
  }

  private static void closeAfterFailedAcquisition(FileChannel channel, Throwable failure) {
    if (channel != null)
      try {
        channel.close();
      } catch (IOException closeError) {
        failure.addSuppressed(closeError);
      }
  }

  /** Idempotent: releases only this bean's acquired lock and its own channel. */
  @Override
  @PreDestroy
  public synchronized void close() throws IOException {
    IOException failure = null;
    try {
      if (lock.isValid()) lock.release();
    } catch (IOException e) {
      failure = e;
    }
    try {
      channel.close();
    } catch (IOException e) {
      if (failure == null) failure = e;
      else failure.addSuppressed(e);
    }
    if (failure != null) throw failure;
  }
}
