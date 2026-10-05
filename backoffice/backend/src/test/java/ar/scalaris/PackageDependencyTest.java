package ar.scalaris;

import static org.assertj.core.api.Assertions.*;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;

/** Small source guard: no architecture library or runtime wiring is required. */
class PackageDependencyTest {
  private static final Pattern LOCAL_IMPORT =
      Pattern.compile("(?m)^import (?:static )?ar\\.scalaris\\.([a-z]+)\\.");
  private static final Map<String, Set<String>> ALLOWED =
      Map.of(
          "controller", Set.of("service", "dto", "mapper", "domain", "exception"),
          "service",
              Set.of("service", "repository", "domain", "dto", "mapper", "storage", "exception"),
          "domain", Set.of("domain"),
          "repository", Set.of("repository", "mapper", "domain", "exception"),
          "dto", Set.of("dto", "mapper", "domain", "exception"),
          "mapper", Set.of("mapper", "dto", "domain"),
          "storage", Set.of("storage", "exception"),
          "exception", Set.of("exception"),
          "config", Set.of("config", "storage", "exception"));

  @Test
  void packagesRespectTheirResponsibilityAndDomainRemainsPure() throws Exception {
    Path source = Path.of("src/main/java/ar/scalaris");
    try (var files = Files.walk(source)) {
      for (Path file : files.filter(path -> path.toString().endsWith(".java")).toList()) {
        Path relative = source.relativize(file);
        String content = Files.readString(file);
        if (relative.getNameCount() == 1) {
          assertThat(file.getFileName().toString())
              .as("Root entry point only")
              .isEqualTo("Application.java");
          continue;
        }
        String area = relative.getName(0).toString();
        assertThat(ALLOWED).containsKey(area);
        var imports = LOCAL_IMPORT.matcher(content);
        while (imports.find())
          assertThat(ALLOWED.get(area))
              .as("%s imports %s", relative, imports.group(1))
              .contains(imports.group(1));
        if (area.equals("domain"))
          assertThat(content)
              .as("Pure domain: %s", relative)
              .doesNotContain(
                  "org.springframework",
                  "java.sql",
                  "com.fasterxml",
                  "ar.scalaris.dto",
                  "ar.scalaris.repository");
        if (Set.of("controller", "service").contains(area))
          assertThat(content)
              .as("SQL belongs to repositories: %s", relative)
              .doesNotContain(
                  "JdbcTemplate", "SELECT ", "INSERT INTO ", "UPDATE cases", "FOR UPDATE");
        if (area.equals("controller"))
          assertThat(content).doesNotContain("ar.scalaris.repository", "ar.scalaris.storage");
      }
    }
  }
}
