"""Small checks for public/private separation and manual ARS cost input."""
import importlib.util
import hashlib
import copy
import json
from pathlib import Path
import tempfile
import unittest
import sys
from types import SimpleNamespace
from unittest.mock import Mock, patch

sys.dont_write_bytecode = True


spec = importlib.util.spec_from_file_location("catalog_import", Path(__file__).with_name("import-catalog.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class CatalogImportTests(unittest.TestCase):
    def record(self):
        return {"id": "nb-123", "supplier": "nb", "supplierCode": "123", "name": "TECLADO LOGITECH MK345", "manufacturerId": "MK345", "category": "Periféricos", "brand": "Logitech", "image": "https://example.com/a.jpg", "cost": {"currency": "USD", "net": 29, "gross": 32.04, "vatRate": 0.105, "vatIncluded": True}, "quantityPrices": [{"minQuantity": 1, "gross": 32.04}], "supplierStockSnapshot": 20}

    def test_public_record_has_no_wholesale_cost_or_stock(self):
        result = module.public_product(self.record())
        self.assertEqual(set(result), {"id", "name", "category", "brand", "image", "description", "price", "currency"})
        self.assertIsNone(result["price"])
        self.assertEqual(result["currency"], "ARS")
        self.assertNotIn("32.04", json.dumps(result))

    def test_distriland_exact_variant_price_and_original_line(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "paste.txt"
            path.write_text("Inicio\n\nModulo Samsung A15 4G - comprar online\nModulo Samsung A15 4G\n$12.345\n Detalles\n", encoding="utf8")
            records, source = module.distriland_import(path)
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["name"], "Modulo Samsung A15 4G")
        self.assertEqual(records[0]["cost"]["gross"], 12345)
        self.assertIsNone(records[0]["cost"]["vatIncluded"])
        self.assertEqual(records[0]["sourceRow"], 5)
        self.assertIsNone(source["sourceDate"])

    def test_ars_override_preserves_original_and_does_not_convert(self):
        record = self.record()
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "pesos.csv"
            path.write_text("id,costARS\nnb-123,54321.75\n", encoding="utf8")
            module.apply_nb_ars([record], path)
        self.assertEqual(record["cost"]["currency"], "ARS")
        self.assertEqual(record["cost"]["gross"], 54321.75)
        self.assertEqual(record["costFromSource"]["currency"], "USD")
        self.assertEqual(record["costFromSource"]["gross"], 32.04)
        self.assertEqual(record["quantityPrices"], [{"minQuantity": 1, "gross": 54321.75}])

    def test_unknown_or_invalid_ars_cost_is_rejected(self):
        for contents in ["id,costARS\nnb-999,10\n", "id,costARS\nnb-123,NaN\n", "id,costARS\nnb-123,-1\n", "id,costARS\nnb-123,10\nnb-123,20\n"]:
            with self.subTest(contents=contents), tempfile.TemporaryDirectory() as directory:
                path = Path(directory) / "pesos.csv"
                path.write_text(contents, encoding="utf8")
                with self.assertRaises(ValueError):
                    module.apply_nb_ars([self.record()], path)

    def test_notebook_parts_are_not_computers(self):
        self.assertEqual(module.category_for("NETBOOKS NOTEBOOKS", "NOTEBOOK LENOVO"), "Notebooks y computadoras")
        self.assertEqual(module.category_for("TECLADOS NET NOTEBOOKS", "TECLADO LENOVO"), "Accesorios y repuestos de notebooks")

    def test_explicit_product_types_precede_broad_mobile_or_accessory_rules(self):
        cases = [
            ("PLACAS DE VIDEO", "PLACA DE VIDEO MSI RTX3050", "Componentes de PC"),
            ("ACCESS POINT", "ACCESS POINT TP-LINK EAP225", "Redes y conectividad"),
            ("PANTALLAS CELULARES", "PANTALLA SAMSUNG A15", "Repuestos de celulares"),
            ("FLEXIBLES CONSOLAS", "FLEX PLAYSTATION PS4", "Repuestos de consolas"),
            ("COOLERS CONSOLAS", "COOLER XBOX ONE", "Repuestos de consolas"),
            ("MODULOS TABLETS", "MODULO SAMSUNG TAB A", "Repuestos de tablets"),
            ("PANTALLAS TABLETS", "PANTALLA SAMSUNG TAB A", "Repuestos de tablets"),
            ("BATERIAS TABLETS", "BATERIA SAMSUNG TAB A", "Repuestos de tablets"),
            ("BATERIAS NET NOTEBOOK", "BATERIA LENOVO", "Accesorios y repuestos de notebooks"),
            ("", "BATERIA NOTEBOOK LENOVO", "Accesorios y repuestos de notebooks"),
            ("", "MODULO PANTALLA TABLET SAMSUNG", "Repuestos de tablets"),
            ("", "FLEX DE CARGA TABLET IPAD AIR", "Repuestos de tablets"),
            ("", "FLEX PARA NINTENDO SWITCH", "Repuestos de consolas"),
            ("ARDUINO MODULOS", "MODULO ARDUINO UNO", "Componentes electrónicos"),
            ("FUNDAS DE TABLETS", "FUNDA SAMSUNG TAB A", "Accesorios para celulares y tablets"),
        ]
        for source, name, expected in cases:
            with self.subTest(source=source, name=name):
                self.assertEqual(module.category_for(source, name), expected)

    def test_skip_extraction_preserves_existing_images_only_for_same_pdf(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            pdf = root / "snapshot.data"
            pdf.write_bytes(b"same supplier snapshot")
            images = root / "images"
            images.mkdir()
            (images / "tp-1.jpg").write_bytes(b"existing thumbnail")
            private = root / "costs.json"
            private.write_text(json.dumps({
                "sources": [{"id": "tecnoprices", "sha256": hashlib.sha256(pdf.read_bytes()).hexdigest()}],
                "products": [
                    {"id": "tp-1", "supplier": "tecnoprices", "image": "./assets/products/tp-1.jpg"},
                    {"id": "tp-2", "supplier": "tecnoprices", "image": "./assets/products/missing.jpg"},
                    {"id": "tp-3", "supplier": "tecnoprices", "image": "./assets/products/../outside.jpg"},
                ],
            }), encoding="utf8")
            self.assertEqual(module.retained_pdf_images(private, pdf, images, "./assets/products"), {"tp-1": "./assets/products/tp-1.jpg"})
            pdf.write_bytes(b"new supplier snapshot")
            self.assertEqual(module.retained_pdf_images(private, pdf, images, "./assets/products"), {})

    def nb_export_rows(self):
        return [
            ["Identificador de URL", "Nombre", "Categorías", "Stock", "SKU", "Precio", "Costo", "Impuesto interno"],
            [123.0, "TECLADO LOGITECH MK345", "TECLADOS", 20, "MK345", 99999.99, 12345.67, 0],
        ]

    def test_nb_store_export_uses_cost_not_retail_price_and_explicit_currency(self):
        rows = self.nb_export_rows()
        with self.assertRaisesRegex(ValueError, "no declara moneda"):
            module.parse_nb_cost_rows(rows)
        updates = module.parse_nb_cost_rows(rows, "ARS")
        self.assertEqual(updates[0]["id"], "nb-123")
        self.assertEqual(updates[0]["gross"], 12345.67)
        self.assertEqual(updates[0]["currency"], "ARS")
        self.assertNotEqual(updates[0]["gross"], rows[1][5])
        self.assertEqual(updates[0]["sourceRow"], 2)

    def test_nb_store_export_rejects_duplicates_and_nonpositive_cost(self):
        duplicate_rows = self.nb_export_rows()
        duplicate_rows.append(list(duplicate_rows[1]))
        with self.assertRaisesRegex(ValueError, "ID repetido"):
            module.parse_nb_cost_rows(duplicate_rows, "ARS")
        for cost in [0, -1, "NaN", None]:
            with self.subTest(cost=cost):
                rows = self.nb_export_rows()
                rows[1][6] = cost
                with self.assertRaises(ValueError):
                    module.parse_nb_cost_rows(rows, "ARS")

    def test_nb_update_preserves_metadata_usd_origin_and_other_suppliers(self):
        record = self.record()
        record.update({"gallery": ["https://example.com/a.jpg", "https://example.com/b.jpg"], "sourceRow": 1310, "warranty": "12 meses"})
        missing = {**self.record(), "id": "nb-999", "name": "PRODUCTO AUSENTE"}
        other = {"id": "tp-1", "supplier": "tecnoprices", "cost": {"currency": "ARS", "gross": 1234}, "image": "./assets/products/tp-1.jpg"}
        original_record = copy.deepcopy(record)
        original_other = copy.deepcopy(other)
        catalog = {"version": 1, "products": [record, missing, other], "sources": [{"id": "nb", "fileName": "original-usd.xlsx"}]}
        source = {"id": "nb-costs-new", "hasCurrencyColumn": False}
        updates = module.parse_nb_cost_rows(self.nb_export_rows(), "ARS")
        audit = module.merge_nb_costs(catalog, updates, source, "2026-10-20")
        self.assertEqual(audit["updatedCount"], 1)
        self.assertEqual(audit["missingIds"], ["nb-999"])
        self.assertEqual(other, original_other)
        for key in ["image", "gallery", "name", "manufacturerId", "sourceRow", "warranty", "category"]:
            self.assertEqual(record[key], original_record[key])
        self.assertEqual(record["cost"]["currency"], "ARS")
        self.assertEqual(record["cost"]["gross"], 12345.67)
        self.assertEqual(record["cost"]["vatRate"], 0.105)
        self.assertTrue(record["cost"]["vatIncluded"])
        self.assertEqual(record["costFromSource"], original_record["cost"])
        self.assertFalse(record["costRequiresConfirmation"])
        self.assertTrue(missing["missingFromLatestNbList"])
        self.assertTrue(missing["costRequiresConfirmation"])
        self.assertEqual(missing["cost"]["currency"], "USD")
        # Repeating the update must retain the first USD source and avoid duplicate sources.
        module.merge_nb_costs(catalog, updates, source, "2026-10-20")
        self.assertEqual(record["costFromSource"], original_record["cost"])
        self.assertEqual([item["id"] for item in catalog["sources"]].count("nb-costs-new"), 1)

    def test_unknown_sku_or_changed_variant_does_not_mutate_catalog(self):
        for column, value in [(0, 999), (1, "OTRA VARIANTE"), (4, "OTRO SKU")]:
            with self.subTest(column=column):
                catalog = {"version": 1, "products": [self.record()], "sources": [{"id": "nb"}]}
                original = copy.deepcopy(catalog)
                rows = self.nb_export_rows()
                rows[1][column] = value
                updates = module.parse_nb_cost_rows(rows, "ARS")
                with self.assertRaises(ValueError):
                    module.merge_nb_costs(catalog, updates, {"id": "new"}, "2026-10-20")
                self.assertEqual(catalog, original)

    def test_real_xls_signature_retries_only_the_known_ole_sector_error(self):
        class ContainerError(Exception):
            pass
        rows = self.nb_export_rows()
        sheet = SimpleNamespace(name="Worksheet", nrows=len(rows), row_values=lambda index: rows[index])
        book = SimpleNamespace(sheets=lambda: [sheet], release_resources=Mock())
        opener = Mock(side_effect=[ContainerError("Workbook corruption: seen[2] == 4"), book])
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "real-signature.xls"
            path.write_bytes(bytes.fromhex("d0cf11e0a1b11ae1"))
            with patch.dict(sys.modules, {"xlrd": SimpleNamespace(open_workbook=opener), "xlrd.compdoc": SimpleNamespace(CompDocError=ContainerError)}):
                result, metadata = module.read_nb_rows(path)
        self.assertEqual(len(result), 2)
        self.assertEqual(opener.call_count, 2)
        self.assertNotIn("ignore_workbook_corruption", opener.call_args_list[0].kwargs)
        self.assertTrue(opener.call_args_list[1].kwargs["ignore_workbook_corruption"])
        self.assertEqual(metadata["format"], "xls-biff")
        self.assertIn("seen[2] == 4", metadata["readerNotes"][0])
        book.release_resources.assert_called_once()

    def test_unrelated_xls_reader_errors_are_not_silenced_or_retried(self):
        class ContainerError(Exception):
            pass
        for error in [ContainerError("Workbook corruption: different defect"), ValueError("unrelated reader error")]:
            with self.subTest(error=error), tempfile.TemporaryDirectory() as directory:
                path = Path(directory) / "unreadable.xls"
                path.write_bytes(bytes.fromhex("d0cf11e0a1b11ae1"))
                opener = Mock(side_effect=error)
                with patch.dict(sys.modules, {"xlrd": SimpleNamespace(open_workbook=opener), "xlrd.compdoc": SimpleNamespace(CompDocError=ContainerError)}):
                    with self.assertRaises(type(error)):
                        module.read_nb_rows(path)
                self.assertEqual(opener.call_count, 1)


if __name__ == "__main__":
    unittest.main()
