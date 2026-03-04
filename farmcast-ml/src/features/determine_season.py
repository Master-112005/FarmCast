"""Season derivation utilities for yield feature engineering."""

from datetime import datetime


def determine_season(sowing_date: str) -> str:
    """
    Determine the agricultural season from a sowing date.

    Args:
        sowing_date: Date string in ISO format (YYYY-MM-DD).

    Returns:
        One of: "Kharif", "Rabi", "Summer".

    Raises:
        ValueError: If sowing_date is missing or not in YYYY-MM-DD format.
    """
    if sowing_date is None or str(sowing_date).strip() == "":
        raise ValueError(
            "Sowing date is required for season determination."
        )

    if not isinstance(sowing_date, str):
        raise ValueError(
            "Invalid date format. Expected YYYY-MM-DD."
        )

    try:
        month = datetime.strptime(
            sowing_date, "%Y-%m-%d"
        ).month
    except ValueError as exc:
        raise ValueError(
            "Invalid date format. Expected YYYY-MM-DD."
        ) from exc

    if 6 <= month <= 10:
        return "Kharif"
    if month in {11, 12, 1, 2, 3}:
        return "Rabi"
    return "Summer"
