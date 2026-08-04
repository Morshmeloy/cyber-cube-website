import httpx
from src.core.config import settings

MATERIALS_FOLDER_KEY = (
    "e78d98aa-8fe7-11f1-980f-fa163ed5121c"  # Catalog_Номенклатура, папка «Материалы»
)


def _client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        base_url=settings.ONEC_BASE_URL,
        auth=(settings.ONEC_USERNAME, settings.ONEC_PASSWORD),
        timeout=30.0,
    )


async def fetch_nomenclature() -> list[tuple[str, str]]:
    """Возвращает [(guid, название), ...] — только позиции из папки «Материалы»
    Catalog_Номенклатура (сайт не должен показывать всё подряд, только то,
    что бухгалтер сознательно туда положил)."""
    async with _client() as client:
        response = await client.get(
            "/Catalog_Номенклатура",
            params={
                "$format": "json",
                "$select": "Ref_Key,Description",
                "$filter": f"Parent_Key eq guid'{MATERIALS_FOLDER_KEY}'",
            },
        )
        response.raise_for_status()
        rows = response.json()["value"]
        return [(row["Ref_Key"], row["Description"]) for row in rows]


async def fetch_balances() -> dict[str, float]:
    """Возвращает {guid_номенклатуры: суммарное_количество} из AccountingRegister_Хозрасчетный.
    Без привязки к конкретному счёту — бухгалтер использует разные субсчета 10.*
    для разных категорий (материалы, ГСМ, запчасти и т.д.), поэтому берём весь
    регистр и оставляем только строки, где субконто1 — товарная позиция."""
    async with _client() as client:
        response = await client.get(
            "/AccountingRegister_Хозрасчетный/Balance",
            params={"$format": "json", "$top": "10000"},
        )
        response.raise_for_status()
        rows = response.json()["value"]
        totals: dict[str, float] = {}
        for row in rows:
            if row.get("ExtDimension1_Type") != "StandardODATA.Catalog_Номенклатура":
                continue
            guid = row["ExtDimension1"]
            totals[guid] = totals.get(guid, 0) + (row["КоличествоBalance"] or 0)
        return totals
