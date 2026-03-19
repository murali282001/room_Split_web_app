def paise_to_rupees(paise: int) -> float:
    return round(paise / 100, 2)


def rupees_to_paise(rupees: float) -> int:
    return int(round(rupees * 100))


def format_inr(paise: int) -> str:
    return f"\u20b9{paise_to_rupees(paise):,.2f}"
