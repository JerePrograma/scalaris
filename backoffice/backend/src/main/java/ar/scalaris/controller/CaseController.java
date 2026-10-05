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
public class CaseController {
  private final Workflow workflow;

  public CaseController(Workflow workflow) {
    this.workflow = workflow;
  }

  @PostMapping("/cases")
  public Map<String, Object> create(@RequestBody JsonNode n) {
    return ApiMapper.caseView(workflow.createCase(n));
  }

  @PutMapping("/cases/{id}")
  public Map<String, Object> edit(@PathVariable long id, @RequestBody JsonNode n) {
    return ApiMapper.caseView(workflow.editCase(id, n));
  }

  @PostMapping("/cases/{id}/transition")
  public Map<String, Object> transition(@PathVariable long id, @RequestBody JsonNode n) {
    return ApiMapper.caseView(workflow.transition(id, n));
  }

  @PostMapping("/cases/{id}/notes")
  public Map<String, Object> note(@PathVariable long id, @RequestBody JsonNode n) {
    workflow.note(id, n);
    return Map.of("ok", true);
  }

  @PutMapping("/cases/{id}/work")
  public Map<String, Object> work(@PathVariable long id, @RequestBody JsonNode n) {
    return ApiMapper.work(workflow.work(id, n));
  }
}
