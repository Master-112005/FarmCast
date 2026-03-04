"""Weather feature repository with in-memory caching."""

from pathlib import Path

import pandas as pd


_WEATHER_CACHE = None
_WEATHER_DATA_PATH = (
    Path(__file__).resolve().parents[2]
    / "data"
    / "processed"
    / "weather_aggregated.parquet"
)
_STATE_ALIASES = {
    "andhra pradesh": "Andhra Pradesh",
    "telangana": "Telangana",
}
_DISTRICT_ALIASES = {
    "adilabad": "Adilabad",
    "anantapur": "Anantapur",
    "bhadradri": "Bhadradri Kothagudem",
    "bhadradri kothagudem": "Bhadradri Kothagudem",
    "chittor": "Chittoor",
    "chittoor": "Chittoor",
    "cuddapah": "Cuddapah",
    "east godavari": "East Godavari",
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
    "rajanna siricilla": "Rajanna Siricilla",
    "ranga reddy": "Ranga Reddy",
    "rangareddi": "Ranga Reddy",
    "srikakulam": "Srikakulam",
    "vijayanagaram": "Vijayanagaram",
    "vizianagaram": "Vijayanagaram",
    "visakhapatnam": "Visakhapatnam",
    "visakhapatanam": "Visakhapatnam",
    "warangal": "Warangal",
    "west godavari": "West Godavari",
}


def _canonical_state(value: str) -> str:
    token = str(value).strip().lower()
    return _STATE_ALIASES.get(token, token.title())


def _canonical_district(value: str) -> str:
    token = str(value).strip().lower()
    return _DISTRICT_ALIASES.get(token, token.title())


def _load_weather_data():
    global _WEATHER_CACHE
    if _WEATHER_CACHE is None:
        weather_df = pd.read_parquet(
            _WEATHER_DATA_PATH
        )
        weather_df["state"] = weather_df[
            "state"
        ].map(_canonical_state)
        weather_df["district"] = weather_df[
            "district"
        ].map(_canonical_district)
        _WEATHER_CACHE = weather_df
    return _WEATHER_CACHE


def fetch_weather_features(
    state: str,
    district: str,
    season: str,
    year: int,
):
    """Fetch weather features for state-district-season-year."""
    weather_df = _load_weather_data()
    state = _canonical_state(state)
    district = _canonical_district(district)
    weather_match = weather_df[
        (weather_df["state"] == state)
        & (weather_df["district"] == district)
        & (weather_df["season"] == season)
        & (weather_df["year"] == year)
    ]

    if weather_match.empty:
        fallback = weather_df[
            (weather_df["state"] == state)
            & (weather_df["district"] == district)
            & (weather_df["season"] == season)
        ]
        if not fallback.empty:
            row = fallback.sort_values(
                "year"
            ).iloc[-1]
            return (
                row["rainfall_total"],
                row["avg_temp"],
                row["avg_humidity"],
            )

        fallback_state = weather_df[
            (weather_df["state"] == state)
            & (weather_df["season"] == season)
        ]
        if not fallback_state.empty:
            row = fallback_state.sort_values(
                "year"
            ).iloc[-1]
            return (
                row["rainfall_total"],
                row["avg_temp"],
                row["avg_humidity"],
            )

        fallback_state_whole_year = weather_df[
            (weather_df["state"] == state)
            & (weather_df["season"] == "Whole Year")
        ]
        if not fallback_state_whole_year.empty:
            row = fallback_state_whole_year.sort_values(
                "year"
            ).iloc[-1]
            return (
                row["rainfall_total"],
                row["avg_temp"],
                row["avg_humidity"],
            )

        raise ValueError(
            "No weather data found for "
            f"{state}-{district}-{season}-{year}"
        )

    row = weather_match.iloc[0]
    return (
        row["rainfall_total"],
        row["avg_temp"],
        row["avg_humidity"],
    )
