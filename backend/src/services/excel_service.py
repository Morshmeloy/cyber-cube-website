import io
from datetime import datetime
from typing import Any
from openpyxl.workbook import Workbook

ORGANIZATION_NAME = 'ООО "Д4 ТЕХНОЛОГИИ"'
WAREHOUSE_NAME = "Основной склад"  # единственный склад в системе, см. onec_client.py


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


def build_requirement_invoice_export(operations: list) -> bytes:
    """Экспорт выбранных операций в формате «Требование-накладная» (см. присланный
    пользователем пример) — номер документа и подписи (Отпустил/Получил) оставлены
    пустыми, заполняются от руки после печати."""
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Требование-накладная"

    today = datetime.now().strftime("%d.%m.%Y")
    sheet.append([f"Требование-накладная № _____ от {today} г."])
    sheet.append([])
    sheet.append(["Организация:", ORGANIZATION_NAME])
    sheet.append(["Склад:", WAREHOUSE_NAME])
    sheet.append([])
    sheet.append(["№", "Код", "Материал", "Количество", "Ед. изм."])

    for i, op in enumerate(operations, start=1):
        sheet.append(
            [
                i,
                op.nomenclature.code or "",
                op.nomenclature.name,
                op.quantity,
                op.nomenclature.unit or "",
            ]
        )

    sheet.append([])
    sheet.append(["Отпустил:", "", "", "Получил:", ""])

    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()
