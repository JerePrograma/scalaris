package ar.scalaris.storage;

import static ar.scalaris.exception.RequestErrors.bad;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.UUID;
import org.springframework.stereotype.Component;

/** Filesystem I/O for attachments; retaining StorageLock keeps storage exclusive for this context. */
@Component
public final class AttachmentStorage {
  private final StorageLock lock;

  public AttachmentStorage(StorageLock lock) {
    this.lock = lock;
  }

  public Path writeNew(UUID name, byte[] bytes) throws IOException {
    var target = lock.root().resolve(name.toString());
    // CREATE_NEW guarantees that cleanup can never remove another upload's file.
    var output = Files.newOutputStream(target, StandardOpenOption.CREATE_NEW);
    try (output) {
      output.write(bytes);
    } catch (IOException | RuntimeException | Error failure) {
      try {
        Files.deleteIfExists(target);
      } catch (IOException cleanupError) {
        failure.addSuppressed(cleanupError);
      }
      throw failure;
    }
    return target;
  }

  public byte[] read(String name) throws IOException {
    var path = lock.root().resolve(name).normalize();
    if (!lock.root().equals(path.getParent()) || Files.isSymbolicLink(path))
      throw bad("Ruta de adjunto inválida.");
    return Files.readAllBytes(path);
  }

  public void removeCreated(Path target) throws IOException {
    if (!lock.root().equals(target.getParent()) || Files.isSymbolicLink(target))
      throw new IOException("No se puede limpiar una ruta ajena al almacenamiento: " + target);
    Files.deleteIfExists(target);
  }
}
