package ar.scalaris.storage;

import static org.assertj.core.api.Assertions.*;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.FileAlreadyExistsException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class AttachmentStorageTest {
  @TempDir Path temp;

  @Test
  void roundTripRetainsBytesAndRejectsOutsidePaths() throws Exception {
    try (var lock = new StorageLock(temp.resolve("storage").toString())) {
      var storage = new AttachmentStorage(lock);
      var name = UUID.randomUUID();
      var bytes = "Notas: configuración y revisión".getBytes(StandardCharsets.UTF_8);
      var target = storage.writeNew(name, bytes);
      assertThat(storage.read(name.toString())).isEqualTo(bytes);
      assertThatThrownBy(() -> storage.read("../outside.txt")).hasMessageContaining("Ruta");
      storage.removeCreated(target);
      assertThat(Files.exists(target)).isFalse();
    }
  }

  @Test
  void existingFileIsNeverDeletedAfterNameCollision() throws Exception {
    try (var lock = new StorageLock(temp.resolve("storage").toString())) {
      var storage = new AttachmentStorage(lock);
      var name = UUID.randomUUID();
      storage.writeNew(name, "original".getBytes(StandardCharsets.UTF_8));
      assertThatThrownBy(() -> storage.writeNew(name, "replacement".getBytes(StandardCharsets.UTF_8)))
          .isInstanceOf(FileAlreadyExistsException.class);
      assertThat(storage.read(name.toString())).isEqualTo("original".getBytes(StandardCharsets.UTF_8));
    }
  }

  @Test
  void rollbackCleanupCannotDeleteOutsideStorage() throws Exception {
    var outside = temp.resolve("keep.txt");
    Files.writeString(outside, "keep");
    try (var lock = new StorageLock(temp.resolve("storage").toString())) {
      var storage = new AttachmentStorage(lock);
      assertThatThrownBy(() -> storage.removeCreated(outside)).isInstanceOf(IOException.class);
      assertThat(Files.readString(outside)).isEqualTo("keep");
    }
  }
}
