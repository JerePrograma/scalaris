package ar.scalaris.config;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.StreamReadConstraints;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class JsonLimits {
  @Bean
  Jackson2ObjectMapperBuilderCustomizer limits() {
    return builder ->
        builder
            .serializerByType(
                java.math.BigDecimal.class,
                com.fasterxml.jackson.databind.ser.std.ToStringSerializer.instance)
            .featuresToEnable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION)
            .postConfigurer(
                mapper ->
                    mapper
                        .getFactory()
                        .setStreamReadConstraints(
                            StreamReadConstraints.builder()
                                .maxNestingDepth(30)
                                .maxStringLength(12000)
                                .maxNumberLength(20)
                                .build()));
  }
}
