import io
from typing import Any
from openpyxl.workbook import Workbook


def _write_rows(headers: list[str], rows: list[list[Any]]) -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet.append(headers)
    for row in rows:
        sheet.append(row)
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


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
