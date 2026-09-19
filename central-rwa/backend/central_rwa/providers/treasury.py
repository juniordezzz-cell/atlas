"""Tesouro dos EUA — taxas diárias dos T-bills, CSV público, sem chave.
Sondado em 2026-09-19 (última linha: 09/18/2026).

GET https://home.treasury.gov/resource-center/data-chart-center/interest-rates/
    daily-treasury-rates.csv/{ano}/all?type=daily_treasury_bill_rates&field_tdr_date_value={ano}&page&_format=csv
Colunas: Date, "4 WEEKS BANK DISCOUNT", "4 WEEKS COUPON EQUIVALENT", ... "52 WEEKS COUPON EQUIVALENT"
Usamos o "COUPON EQUIVALENT" (comparável a um rendimento anual).
"""

from __future__ import annotations

import csv
import io
import re
from datetime import datetime

from ..models import TbillRate
from .base import Provider

URL = (
    "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/"
    "daily-treasury-rates.csv/{year}/all"
)
_COL = re.compile(r"^(\d+) WEEKS COUPON EQUIVALENT$")


class Treasury(Provider):
    name = "treasury"

    def tbill_rates(self, year: int) -> list[TbillRate]:
        resp = self.get(
            URL.format(year=year),
            params={"type": "daily_treasury_bill_rates", "field_tdr_date_value": year, "page": "", "_format": "csv"},
        )
        return parse_csv(resp.text, self.name)


def parse_csv(text: str, source: str) -> list[TbillRate]:
    out: list[TbillRate] = []
    reader = csv.DictReader(io.StringIO(text))
    for row in reader:
        try:
            day = datetime.strptime(row["Date"], "%m/%d/%Y").date()
        except (KeyError, ValueError):
            continue
        for col, val in row.items():
            m = _COL.match((col or "").strip())
            if not m or not val or val.strip() in ("", "N/A"):
                continue
            try:
                out.append(TbillRate(day=day, tenor=f"{m.group(1)}w", rate=float(val), source=source))
            except ValueError:
                continue
    return out
