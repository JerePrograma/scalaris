package ar.scalaris.service;

import ar.scalaris.dto.request.RequestInput;
import com.fasterxml.jackson.databind.JsonNode;
import java.io.*;
import java.math.BigDecimal;
import java.util.*;
import org.apache.pdfbox.pdmodel.*;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.*;
import org.springframework.stereotype.Component;

/**
 * PDF is rendered exclusively from the selected revision's snapshot. No live catalog/client lookup.
 */
@Component
public class QuotePdf {
  public byte[] create(Map<String, Object> revision) throws IOException {
    JsonNode n = (JsonNode) revision.get("snapshot");
    try (var doc = new PDDocument();
        var output = new ByteArrayOutputStream()) {
      try (var fontStream = getClass().getResourceAsStream("/brand/inter-400.ttf")) {
        if (fontStream == null) throw new IOException("Fuente Scalaris ausente");
        PDFont font = PDType0Font.load(doc, fontStream);
        var writer = new Writer(doc, font);
        try (var logo = getClass().getResourceAsStream("/brand/logo.png")) {
          if (logo == null) throw new IOException("Logo Scalaris ausente");
          writer.logo(logo.readAllBytes());
        }
        writer.line("Tu tecnología, en buenas manos.", 11);
        writer.line("WhatsApp 2291402230 | wa.me/5492291402230", 10);
        writer.gap(14);
        writer.line(
            "PRESUPUESTO #"
                + n.path("quoteNumber").asText()
                + " / Revisión "
                + n.path("revision").asText(),
            18);
        writer.line(
            "Presupuesto en ARS. No es factura fiscal. Estado: "
                + Map.of("DRAFT", "Borrador", "SENT", "Enviado", "ACCEPTED", "Aceptado")
                    .get(revision.get("status")),
            10);
        writer.line("Cliente: " + n.path("client").path("name").asText(), 12);
        writer.line(
            "Consulta #" + n.path("caseNumber").asText() + ": " + n.path("caseTitle").asText(), 11);
        writer.line(
            "Emisión: "
                + n.path("issueDate").asText()
                + " | Vencimiento: "
                + n.path("expiryDate").asText(),
            11);
        writer.line("Plazo: " + n.path("leadTime").asText(), 11);
        writer.gap(12);
        for (JsonNode item : n.path("items")) {
          writer.line(
              Map.of("LABOR", "Mano de obra", "PART", "Repuesto", "OTHER", "Otro")
                      .get(item.path("kind").asText())
                  + " - "
                  + item.path("description").asText(),
              12);
          writer.line(
              "Cantidad "
                  + item.path("quantity").asText()
                  + " "
                  + item.path("unit").asText()
                  + " x "
                  + ars(item.path("unitPrice").asText())
                  + " | Bruto "
                  + ars(item.path("gross").asText()),
              10);
          writer.line(
              "Descuento: "
                  + discount(item)
                  + " ("
                  + ars(item.path("discount").asText())
                  + ") | Neto "
                  + ars(item.path("total").asText()),
              10);
          writer.gap(7);
        }
        writer.line("Subtotal: " + ars(revision.get("subtotal").toString()), 12);
        writer.line("Descuento total: " + ars(revision.get("discount").toString()), 12);
        writer.line("Descuento general: " + discount(n), 10);
        writer.line("Ajuste explícito: " + ars(revision.get("adjustment").toString()), 12);
        if (n.has("manualTotal")) writer.line("Motivo: " + n.path("adjustmentReason").asText(), 11);
        writer.line("TOTAL: " + ars(revision.get("total").toString()), 18);
        writer.line(
            "Seña sugerida ("
                + n.path("depositPercent").asText()
                + "%): "
                + ars(n.path("suggestedDeposit").asText()),
            11);
        writer.gap(12);
        writer.line("Condiciones", 13);
        writer.line(
            n.path("conditions").asText().isBlank()
                ? "Sin condiciones adicionales registradas."
                : n.path("conditions").asText(),
            11);
        writer.line(
            "Validez sugerida: 5 días de lunes a viernes. No se consideran feriados; fecha"
                + " editable.",
            10);
        writer.line(
            "Los repuestos se detallan aparte. No incluye licencias comerciales salvo concepto"
                + " explícito legítimo y autorizado.",
            10);
        if (revision.get("accepted_at") != null)
          writer.line(
              "Aceptación manual registrada: "
                  + java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")
                      .withZone(RequestInput.ZONE)
                      .format(java.time.Instant.parse(revision.get("accepted_at").toString()))
                  + " (Buenos Aires) | Canal: "
                  + ((JsonNode) revision.get("acceptance")).path("channel").asText(),
              10);
        writer.close();
        doc.save(output);
        return output.toByteArray();
      }
    }
  }

  private static String ars(String value) {
    var f = java.text.NumberFormat.getCurrencyInstance(Locale.forLanguageTag("es-AR"));
    return "ARS " + f.format(new BigDecimal(value));
  }

  private static String discount(JsonNode n) {
    return switch (n.path("discountType").asText()) {
      case "AMOUNT" -> ars(n.path("discountValue").asText());
      case "PERCENT" -> n.path("discountValue").asText() + "%";
      default -> "Sin descuento";
    };
  }

  private static final class Writer implements AutoCloseable {
    final PDDocument doc;
    final PDFont font;
    PDPageContentStream stream;
    float y;
    int page = 0;

    Writer(PDDocument doc, PDFont font) throws IOException {
      this.doc = doc;
      this.font = font;
      newPage();
    }

    void newPage() throws IOException {
      if (stream != null) stream.close();
      var p = new PDPage(PDRectangle.A4);
      doc.addPage(p);
      stream = new PDPageContentStream(doc, p);
      y = 785;
      page++;
      stream.setNonStrokingColor(11 / 255f, 31 / 255f, 51 / 255f);
      draw("Scalaris | Presupuesto | Página " + page, 9, 42, 28);
    }

    void draw(String s, int size, float x, float at) throws IOException {
      stream.beginText();
      stream.setFont(font, size);
      stream.newLineAtOffset(x, at);
      stream.showText(s);
      stream.endText();
    }

    void gap(int amount) {
      y -= amount;
    }

    void logo(byte[] bytes) throws IOException {
      var image =
          org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject.createFromByteArray(
              doc, bytes, "Scalaris");
      stream.drawImage(image, 42, y - 46, 200, 46);
      y -= 65;
    }

    void line(String text, int size) throws IOException {
      String clean = text.replace('\t', ' ').replaceAll("[\\p{Cntrl}&&[^\\n]]", "");
      for (String paragraph : clean.split("\n", -1)) {
        StringBuilder safe = new StringBuilder();
        for (int cp : paragraph.codePoints().toArray()) {
          String ch = new String(Character.toChars(cp));
          try {
            font.encode(ch);
          } catch (IllegalArgumentException e) {
            ch = "?";
          }
          safe.append(ch);
        }
        StringBuilder line = new StringBuilder();
        float width = 0;
        for (String word : safe.toString().split(" ", -1)) {
          float wordWidth = font.getStringWidth(word) / 1000 * size,
              space = font.getStringWidth(" ") / 1000 * size;
          if (width + (line.isEmpty() ? 0 : space) + wordWidth <= 510) {
            if (!line.isEmpty()) {
              line.append(' ');
              width += space;
            }
            line.append(word);
            width += wordWidth;
            continue;
          }
          if (!line.isEmpty()) {
            emit(line.toString(), size);
            line.setLength(0);
            width = 0;
          }
          for (int cp : word.codePoints().toArray()) {
            String ch = new String(Character.toChars(cp));
            float charWidth = font.getStringWidth(ch) / 1000 * size;
            if (width + charWidth > 510) {
              emit(line.toString(), size);
              line.setLength(0);
              width = 0;
            }
            line.append(ch);
            width += charWidth;
          }
        }
        emit(line.toString(), size);
      }
    }

    void emit(String text, int size) throws IOException {
      if (y < size + 60) newPage();
      draw(text, size, 42, y);
      y -= size * 1.5f;
    }

    public void close() throws IOException {
      stream.close();
    }
  }
}
