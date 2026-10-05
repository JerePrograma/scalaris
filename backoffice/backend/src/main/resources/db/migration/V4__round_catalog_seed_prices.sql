-- V2 is already applied in existing databases; keep its checksum unchanged.
-- Only update catalog entries that still have their original V2 seed price,
-- preserving any price that a user edited after seeding.
WITH rounded_prices(seed_key, original_price, rounded_price) AS (
  VALUES
    ('vidainformatica-1', 11132::NUMERIC, 11130::NUMERIC),
    ('vidainformatica-2', 64931::NUMERIC, 64930::NUMERIC),
    ('vidainformatica-3', 74207::NUMERIC, 74205::NUMERIC),
    ('vidainformatica-4', 18552::NUMERIC, 18550::NUMERIC),
    ('vidainformatica-5', 55654::NUMERIC, 55655::NUMERIC),
    ('vidainformatica-6', 12986::NUMERIC, 12985::NUMERIC),
    ('vidainformatica-7', 14841::NUMERIC, 14840::NUMERIC),
    ('vidainformatica-8', 18552::NUMERIC, 18550::NUMERIC),
    ('vidainformatica-9', 27828::NUMERIC, 27825::NUMERIC),
    ('vidainformatica-10', 14841::NUMERIC, 14840::NUMERIC),
    ('vidainformatica-11', 27828::NUMERIC, 27825::NUMERIC),
    ('vidainformatica-12', 55654::NUMERIC, 55655::NUMERIC),
    ('vidainformatica-14', 70496::NUMERIC, 70495::NUMERIC),
    ('vidainformatica-15', 49013::NUMERIC, 49010::NUMERIC),
    ('vidainformatica-16', 92758::NUMERIC, 92755::NUMERIC),
    ('vidainformatica-17', 148413::NUMERIC, 148410::NUMERIC),
    ('vidainformatica-18', 27828::NUMERIC, 27825::NUMERIC),
    ('vidainformatica-19', 29683::NUMERIC, 29680::NUMERIC),
    ('vidainformatica-20', 55654::NUMERIC, 55655::NUMERIC),
    ('vidainformatica-21', 51946::NUMERIC, 51945::NUMERIC),
    ('vidainformatica-22', 51946::NUMERIC, 51945::NUMERIC),
    ('vidainformatica-23', 29683::NUMERIC, 29680::NUMERIC),
    ('vidainformatica-24', 74207::NUMERIC, 74205::NUMERIC),
    ('vidainformatica-25', 29683::NUMERIC, 29680::NUMERIC),
    ('vidainformatica-26', 40814::NUMERIC, 40815::NUMERIC),
    ('vidainformatica-27', 120586::NUMERIC, 120585::NUMERIC),
    ('vidainformatica-28', 70496::NUMERIC, 70495::NUMERIC)
)
UPDATE catalog AS c
SET price = rp.rounded_price
FROM rounded_prices AS rp
WHERE c.seed_key = rp.seed_key
  AND c.price = rp.original_price;
