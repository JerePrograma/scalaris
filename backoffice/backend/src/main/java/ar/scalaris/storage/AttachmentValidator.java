package ar.scalaris.storage;

import static ar.scalaris.exception.RequestErrors.bad;

import java.io.*;
import java.util.*;
import javax.imageio.ImageIO;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.cos.*;

/** Validates supported attachment content without accessing HTTP requests, JDBC or storage. */
public final class AttachmentValidator {
  private AttachmentValidator() {}
  static boolean starts(byte[] b, int... magic) {
    if (b.length < magic.length) return false;
    for (int i = 0; i < magic.length; i++) if ((b[i] & 255) != magic[i]) return false;
    return true;
  }

  public static String validate(byte[] bytes, String declared) throws IOException {
    if (bytes.length == 0 || bytes.length > 8388608) throw bad("Adjunto vacío o mayor a 8 MB.");
    String mime;
    if (starts(bytes, 137, 80, 78, 71, 13, 10, 26, 10)) mime = "image/png";
    else if (starts(bytes, 255, 216, 255)) mime = "image/jpeg";
    else if (starts(bytes, 37, 80, 68, 70, 45)) mime = "application/pdf";
    else mime = "text/plain";
    if (!mime.equals(declared)) throw bad("El contenido no coincide con el tipo MIME permitido.");
    if (mime.startsWith("image/")) {
      try (var input = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
        var readers = ImageIO.getImageReaders(input);
        if (!readers.hasNext()) throw bad("Imagen inválida.");
        var reader = readers.next();
        try {
          reader.setInput(input);
          long pixels = (long) reader.getWidth(0) * reader.getHeight(0);
          if (pixels > 25000000 || pixels < 1)
            throw bad("Imagen demasiado grande (máximo 25 megapíxeles).");
          if (reader.read(0) == null) throw bad("Imagen inválida.");
        } finally {
          reader.dispose();
        }
      }
    } else if (mime.equals("application/pdf")) {
      try (var pdf = Loader.loadPDF(bytes)) {
        if (pdf.isEncrypted() || pdf.getNumberOfPages() > 100)
          throw bad("PDF cifrado o con más de 100 páginas.");
        var seen = Collections.newSetFromMap(new IdentityHashMap<COSBase, Boolean>());
        checkPdf(pdf.getDocumentCatalog().getCOSObject(), seen, 0);
      } catch (org.springframework.web.server.ResponseStatusException e) {
        throw e;
      } catch (Exception e) {
        throw bad("PDF inválido.");
      }
    } else {
      try {
        String content =
            java.nio.charset.StandardCharsets.UTF_8
                .newDecoder()
                .onMalformedInput(java.nio.charset.CodingErrorAction.REPORT)
                .decode(java.nio.ByteBuffer.wrap(bytes))
                .toString();
        if (content.indexOf('\0') >= 0
            || content.matches("(?is).*<(script|html|svg|iframe|object)\\b.*")
            || content.startsWith("MZ")) throw bad("Texto con contenido activo o binario.");
      } catch (java.nio.charset.CharacterCodingException e) {
        throw bad("Solo texto UTF-8.");
      }
    }
    return mime;
  }

  private static void checkPdf(COSBase base, Set<COSBase> seen, int depth) {
    if (base == null || !seen.add(base)) return;
    if (depth > 100 || seen.size() > 100000) throw bad("PDF demasiado complejo.");
    if (base instanceof COSObject o) {
      checkPdf(o.getObject(), seen, depth + 1);
      return;
    }
    if (base instanceof COSDictionary d) {
      for (COSName key : d.keySet()) {
        if (Set.of(
                "JS",
                "JavaScript",
                "AA",
                "OpenAction",
                "Launch",
                "EmbeddedFiles",
                "EF",
                "RichMedia",
                "XFA",
                "AcroForm")
            .contains(key.getName()))
          throw bad("PDF con acciones, formularios o archivos incrustados no admitido.");
        COSBase value = d.getDictionaryObject(key);
        if (key.getName().equals("S")
            && value instanceof COSName name
            && Set.of("JavaScript", "Launch", "SubmitForm", "ImportData", "GoToR", "URI")
                .contains(name.getName())) throw bad("PDF con acción activa.");
        checkPdf(value, seen, depth + 1);
      }
    } else if (base instanceof COSArray a) for (COSBase value : a) checkPdf(value, seen, depth + 1);
  }

}
