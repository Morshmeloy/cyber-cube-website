import httpx
from src.core.config import settings


def _client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        base_url=settings.ONEC_BASE_URL,
        auth=(settings.ONEC_USERNAME, settings.ONEC_PASSWORD),
        timeout=30.0,
    )


async def fetch_nomenclature() -> list[tuple[str, str]]:
    """Возвращает [(guid, название), ...] из Catalog_Номенклатура."""
    async with _client() as client:
        response = await client.get(
            "/Catalog_Номенклатура",
            params={"$format": "json", "$select": "Ref_Key,Description"},
        )
        response.raise_for_status()
        rows = response.json()["value"]
        return [(row["Ref_Key"], row["Description"]) for row in rows]


async def fetch_balances() -> dict[str, float]:
    """Возвращает {guid_номенклатуры: суммарное_количество} из InformationRegister_ОстаткиТоваров.
    Регистр — не Balance()-таблица, строк может быть несколько на одну номенклатуру
    (разные склады/партии/характеристики) — суммируем сами."""
    async with _client() as client:
        response = await client.get(
            "/InformationRegister_ОстаткиТоваров",
            params={"$format": "json", "$select": "Номенклатура_Key,Количество"},
        )
        response.raise_for_status()
        rows = response.json()["value"]
        totals: dict[str, float] = {}
        for row in rows:
            guid = row["Номенклатура_Key"]
            totals[guid] = totals.get(guid, 0) + (row["Количество"] or 0)
        return totals
