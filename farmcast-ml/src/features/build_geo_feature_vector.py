"""Geo-aware feature construction for yield inference."""

from datetime import datetime
import re

from src.features.determine_season import (
    determine_season,
)
from src.features.weather_repository import (
    fetch_weather_features,
)


_CROP_ALIASES = {
    "banana": "Banana",
    "chilies": "Dry Chillies",
    "chillies": "Dry Chillies",
    "dry_chilies": "Dry Chillies",
    "dry_chillies": "Dry Chillies",
    "cotton": "Cotton(Lint)",
    "cotton_lint": "Cotton(Lint)",
    "groundnut": "Groundnut",
    "groundnuts": "Groundnut",
    "maize": "Maize",
    "rice": "Rice",
    "wheat": "Wheat",
}

_SOIL_ALIASES = {
    "alluvial": "Alluvial Soil",
    "alluvial_soil": "Alluvial Soil",
    "black_cotton": "Black Cotton Soil (Regur)",
    "black_cotton_soil": "Black Cotton Soil (Regur)",
    "black_soil": "Black Cotton Soil (Regur)",
    "coastal_sandy": "Coastal Sandy Soil",
    "coastal_sandy_soil": "Coastal Sandy Soil",
    "red": "Red Soil",
    "red_soil": "Red Soil",
    "regur": "Black Cotton Soil (Regur)",
}

_STATE_ALIASES = {
    "andhra_pradesh": "Andhra Pradesh",
    "telangana": "Telangana",
}

_DISTRICT_ALIASES = {
    "adilabad": "Adilabad",
    "anantapur": "Anantapur",
    "bhadradri": "Bhadradri Kothagudem",
    "bhadradri_kothagudem": "Bhadradri Kothagudem",
    "chittor": "Chittoor",
    "chittoor": "Chittoor",
    "cuddapah": "Cuddapah",
    "east_godavari": "East Godavari",
    "guntur": "Guntur",
    "hyderabad": "Hyderabad",
    "jagitial": "Jagityal",
    "karimnagar": "Karimnagar",
    "khammam": "Khammam",
    "krishna": "Krishna",
    "kurnool": "Kurnool",
    "kadapa": "Cuddapah",
    "mahbubnagar": "Mahbubnagar",
    "medak": "Medak",
    "nalgonda": "Nalgonda",
    "nellore": "Nellore",
    "nizamabad": "Nizamabad",
    "palnadu": "Palnadu",
    "prakasam": "Prakasam",
    "rajanna": "Rajanna Siricilla",
    "rajanna_siricilla": "Rajanna Siricilla",
    "ranga_reddy": "Ranga Reddy",
    "rangareddi": "Ranga Reddy",
    "spsr_nellore": "Nellore",
    "srikakulam": "Srikakulam",
    "vijayanagaram": "Vijayanagaram",
    "vizianagaram": "Vijayanagaram",
    "visakhapatnam": "Visakhapatnam",
    "visakhapatanam": "Visakhapatnam",
    "warangal": "Warangal",
    "warangal_urban": "Warangal",
    "west_godavari": "West Godavari",
}


def _to_token(value: str) -> str:
    return re.sub(
        r"[^a-z0-9]+", "_", str(value).strip().lower()
    ).strip("_")


def _normalize_crop(crop: str) -> str:
    return _CROP_ALIASES.get(
        _to_token(crop), str(crop).strip()
    )


def _normalize_soil(soil: str) -> str:
    return _SOIL_ALIASES.get(
        _to_token(soil), str(soil).strip()
    )


def _normalize_state(state: str) -> str:
    token = _to_token(state)
    return _STATE_ALIASES.get(
        token, str(state).strip().title()
    )


def _normalize_district(district: str) -> str:
    token = _to_token(district)
    return _DISTRICT_ALIASES.get(
        token, str(district).strip().title()
    )


def build_feature_vector(
    state: str,
    district: str,
    crop: str,
    soil: str,
    sowing_date: str,
) -> dict:
    """
    Construct a geo-aware feature dictionary for yield inference.

    Args:
        state: State name.
        district: District name.
        crop: Crop type.
        soil: Soil type.
        sowing_date: ISO date in YYYY-MM-DD format.

    Returns:
        Deterministic feature dictionary aligned to
        model input schema.

    Raises:
        ValueError: If an input is missing or the
        sowing_date format is invalid.
        ValueError: If weather data is unavailable
        for the derived geo-season-year tuple.
    """
    required_inputs = (
        state,
        district,
        crop,
        soil,
        sowing_date,
    )
    if any(
        value is None or str(value).strip() == ""
        for value in required_inputs
    ):
        raise ValueError(
            "All inputs are required to build feature vector."
        )

    season = determine_season(sowing_date)

    try:
        year = datetime.strptime(
            sowing_date, "%Y-%m-%d"
        ).year
    except ValueError as exc:
        raise ValueError(
            "Invalid sowing_date format. Expected YYYY-MM-DD."
        ) from exc

    normalized_crop = _normalize_crop(crop)
    normalized_soil = _normalize_soil(soil)
    normalized_state = _normalize_state(state)
    normalized_district = _normalize_district(
        district
    )

    rainfall, temp, humidity = fetch_weather_features(
        state=normalized_state,
        district=normalized_district,
        season=season,
        year=year,
    )

    return {
        "state": normalized_state,
        "district": normalized_district,
        "crop_type": normalized_crop,
        "soil_type": normalized_soil,
        "season": season,
        "rainfall_mm_total": rainfall,
        "avg_temperature_c": temp,
        "avg_humidity": humidity,
        "year": year,
    }
