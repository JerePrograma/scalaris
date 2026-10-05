package ar.scalaris.controller;

import ar.scalaris.dto.response.*;
import ar.scalaris.mapper.ApiMapper;
import ar.scalaris.service.*;
import java.io.IOException;
import java.util.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api")
public class AttachmentController {
  private final AttachmentService files;

  public AttachmentController(AttachmentService files) {
    this.files = files;
  }

  @PostMapping("/cases/{id}/attachments")
  public Map<String, Object> upload(@PathVariable long id, @RequestParam MultipartFile file)
      throws IOException {
    return ApiMapper.attachment(files.upload(id, file));
  }

  @GetMapping("/attachments/{id}")
  public ResponseEntity<byte[]> download(@PathVariable long id) throws IOException {
    var f = files.download(id);
    return ResponseEntity.ok()
        .contentType(MediaType.parseMediaType(f.mime()))
        .header(
            "Content-Disposition",
            ContentDisposition.attachment()
                .filename(f.originalName(), java.nio.charset.StandardCharsets.UTF_8)
                .build()
                .toString())
        .body(f.bytes());
  }
}
