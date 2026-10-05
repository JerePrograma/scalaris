package ar.scalaris.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.*;

public record Detail(
    @JsonProperty("case") Map<String, Object> caseView,
    Map<String, Object> client,
    List<Map<String, Object>> revisions,
    Map<String, Object> work,
    Balance balance,
    List<Map<String, Object>> payments,
    List<Map<String, Object>> attachments,
    List<Map<String, Object>> events) {}
