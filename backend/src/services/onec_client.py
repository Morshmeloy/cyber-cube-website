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
    """Возвращает {guid_номенклатуры: суммарное_количество} из AccountingRegister_Хозрасчетный.
    Счёт 10.01 «Сырьё и материалы» — GUID зафиксирован (счета плана счетов предопределены,
    не меняются между обращениями). Строк может быть несколько на одну номенклатуру
    (разные склады) — суммируем."""
    account_key = "85836622-8dda-11ee-879b-a8decfe6e8ab"  # ChartOfAccounts_Хозрасчетный, счёт 10.01
    condition = f"AccountCondition='Account_Key eq guid''{account_key}'''"
    async with _client() as client:
        response = await client.get(
            f"/AccountingRegister_Хозрасчетный/Balance({condition})",
            params={"$format": "json"},
        )
        response.raise_for_status()
        rows = response.json()["value"]
        totals: dict[str, float] = {}
        for row in rows:
            guid = row["ExtDimension1"]
            totals[guid] = totals.get(guid, 0) + (row["КоличествоBalance"] or 0)
        return totals
