package ar.scalaris.dto.response;

import java.util.*;

public record Dashboard(
    List<Map<String, Object>> counts,
    Map<String, Object> balances,
    List<Map<String, Object>> recent,
    long pendingCases) {}
