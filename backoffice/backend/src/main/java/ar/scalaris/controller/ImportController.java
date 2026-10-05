package ar.scalaris.controller;

import ar.scalaris.dto.response.*;
import ar.scalaris.mapper.ApiMapper;
import ar.scalaris.service.*;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class ImportController {
  private final PublicImport importer;

  public ImportController(PublicImport importer) {
    this.importer = importer;
  }

  @PostMapping("/imports/preview")
  public Map<String, Object> preview(@RequestBody JsonNode n) {
    return importer.preview(n);
  }

  @PostMapping("/imports/confirm")
  public Map<String, Object> confirm(@RequestBody JsonNode n) {
    return ApiMapper.caseView(importer.confirm(n));
  }
}
