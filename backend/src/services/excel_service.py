import io
from typing import Any
import openpyxl
from openpyxl.workbook import Workbook


def parse_balances_xlsx(file_bytes: bytes) -> list[tuple[str, float]]:
    """
    Разбирает файл в формате отчёта 1С «Остатки товаров»: первая колонка — название,
    вторая — количество. Настоящие строки товара помечены атрибутом outlineLevel=1
    (так 1С проставляет группировку Место хранения → Номенклатура при экспорте) — по
    нему и отличаем товар от служебной строки (шапки, подытога склада, строки «Итого»).
    """
    workbook = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    sheet = workbook.active

    rows: list[tuple[str, float]] = []
    for row_idx, row in enumerate(sheet.iter_rows(min_row=1), start=1):
        outline_level = sheet.row_dimensions[row_idx].outline_level
        if not outline_level:
            continue
        name = row[0].value
        quantity = row[1].value if len(row) > 1 else None
        if not name or quantity is None:
            continue
        rows.append((str(name).strip(), float(quantity)))
    return rows


def _write_rows(headers: list[str], rows: list[list[Any]]) -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet.append(headers)
    for row in rows:
        sheet.append(row)
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def build_balances_export_1c(nomenclature: list) -> bytes:
    """Формат, близкий к отчёту 1С «Остатки товаров» — название + итоговое количество."""
    rows = [[item.name, item.total_quantity] for item in nomenclature]
    return _write_rows(["Номенклатура", "Количество"], rows)


def build_balances_export_report(nomenclature: list) -> bytes:
    """Человекочитаемый отчёт: базовый остаток из 1С / движение через портал / итог."""
    rows = [
        [item.name, item.base_quantity, item.portal_quantity, item.total_quantity]
        for item in nomenclature
    ]
    return _write_rows(
        ["Номенклатура", "Остаток из 1С", "Движение через портал", "Итоговый остаток"],
        rows,
    )


def build_operations_export(operations: list) -> bytes:
    """Экспорт истории выдач/возвратов — для переноса записей в 1С вручную."""
    rows = [
        [
            op.created_at.strftime("%d.%m.%Y %H:%M"),
            op.nomenclature.name,
            "Выдача" if op.operation_type.value == "issue" else "Возврат",
            op.quantity,
            op.person,
            op.destination,
            op.user.username,
        ]
        for op in operations
    ]
    return _write_rows(
        [
            "Дата",
            "Номенклатура",
            "Тип",
            "Количество",
            "ФИО",
            "Адрес/место назначения",
            "Кто ввёл",
        ],
        rows,
    )
