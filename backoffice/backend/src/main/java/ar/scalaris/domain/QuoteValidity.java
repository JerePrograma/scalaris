package ar.scalaris.domain;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.Objects;

/** Editable quote dates; the suggested term counts five weekdays, without holidays. */
public record QuoteValidity(LocalDate issueDate, LocalDate expiryDate) {
  public QuoteValidity {
    Objects.requireNonNull(issueDate);
    Objects.requireNonNull(expiryDate);
    if (expiryDate.isBefore(issueDate))
      throw new BusinessRuleException("El vencimiento no puede preceder a la emisión.");
  }

  public static LocalDate suggestedExpiry(LocalDate issueDate) {
    LocalDate date = issueDate;
    int count = 0;
    while (count < 5) {
      date = date.plusDays(1);
      if (date.getDayOfWeek() != DayOfWeek.SATURDAY && date.getDayOfWeek() != DayOfWeek.SUNDAY)
        count++;
    }
    return date;
  }
}
