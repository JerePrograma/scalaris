package ar.scalaris.service;

import static ar.scalaris.exception.RequestErrors.bad;

import ar.scalaris.repository.jdbc.AttachmentRepository;
import ar.scalaris.repository.jdbc.CaseRepository;
import ar.scalaris.repository.jdbc.EventRepository;
import ar.scalaris.storage.AttachmentStorage;
import ar.scalaris.storage.AttachmentValidator;
import java.io.IOException;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

/** Coordinates the case lock, attachment metadata, filesystem write and immutable event. */
@Service
public class AttachmentService {
  private static final Logger LOG = LoggerFactory.getLogger(AttachmentService.class);
  private final CaseRepository cases;
  private final AttachmentRepository attachments;
  private final EventRepository events;
  private final AttachmentStorage storage;

  public AttachmentService(
      CaseRepository cases,
      AttachmentRepository attachments,
      EventRepository events,
      AttachmentStorage storage) {
    this.cases = cases;
    this.attachments = attachments;
    this.events = events;
    this.storage = storage;
  }

  @Transactional
  public Map<String, Object> upload(long caseId, MultipartFile file) throws IOException {
    cases.lockCase(caseId);
    if (attachments.count(caseId) >= 20) throw bad("Máximo 20 adjuntos por caso.");
    byte[] bytes = file.getBytes();
    String mime = AttachmentValidator.validate(bytes, file.getContentType());
    String original =
        Objects.toString(file.getOriginalFilename(), "archivo")
            .replaceAll("[^\\p{L}\\p{N}._ -]", "_");
    if (original.length() > 160) original = original.substring(original.length() - 160);
    UUID name = UUID.randomUUID();
    Path target = storage.writeNew(name, bytes);
    try {
      TransactionSynchronizationManager.registerSynchronization(
          new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
              if (status != STATUS_COMMITTED) removeUncommitted(target);
            }
          });
    } catch (RuntimeException | Error failure) {
      // An upload called without an active transaction must not leave an orphaned file.
      try {
        storage.removeCreated(target);
      } catch (IOException cleanupError) {
        failure.addSuppressed(cleanupError);
      }
      throw failure;
    }
    String hash;
    try {
      hash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException(e);
    }
    long id = attachments.insert(caseId, name, original, mime, bytes.length, hash);
    events.event(
        caseId,
        "attachment",
        id,
        "ATTACHED",
        Map.of("name", original, "mime", mime, "size", bytes.length, "sha256", hash));
    return attachments.find(id);
  }

  private void removeUncommitted(Path target) {
    try {
      storage.removeCreated(target);
    } catch (IOException cleanupError) {
      LOG.error("No se pudo limpiar un adjunto de una transacción revertida: {}", target, cleanupError);
    }
  }

  public byte[] read(Map<String, Object> file) throws IOException {
    return storage.read(file.get("storage_name").toString());
  }

  public record Download(String mime, String originalName, byte[] bytes) {}

  public Download download(long id) throws IOException {
    var file = attachments.find(id);
    return new Download(file.get("mime").toString(), file.get("original_name").toString(), read(file));
  }
}
