"""FarmCast ML API service."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile, status

from src.api.dependencies import api_key_guard, get_app_config, get_inference_pipeline
from src.api.schemas import (
    DiseaseResponse,
    PriceRequest,
    PriceResponse,
    YieldPredictionRequest,
    YieldResponse,
)
from src.inference.yield_predictor import predict_yield
from src.pipelines.inference_pipeline import InferencePipeline


app_config = get_app_config()

@asynccontextmanager
async def lifespan(_: FastAPI):
    # Initialize singleton container at startup.
    get_inference_pipeline()
    yield


app = FastAPI(title=app_config["api"]["title"], version=app_config["api"]["version"], lifespan=lifespan)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/predict/yield", response_model=YieldResponse, dependencies=[Depends(api_key_guard)])
def predict_yield_endpoint(
    request: YieldPredictionRequest,
    pipeline: InferencePipeline = Depends(get_inference_pipeline),
) -> YieldResponse:
    try:
        payload = request.model_dump()
        is_legacy_payload = "crop" in payload and "soil" in payload and "sowing_date" in payload
        if is_legacy_payload:
            result = predict_yield(payload)
        else:
            result = pipeline.predict("yield", payload)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except ImportError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except TypeError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    return YieldResponse(**result)


@app.post("/predict/price", response_model=PriceResponse, dependencies=[Depends(api_key_guard)])
def predict_price(
    payload: PriceRequest,
    pipeline: InferencePipeline = Depends(get_inference_pipeline),
) -> PriceResponse:
    try:
        result = pipeline.predict("price", payload.model_dump())
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except ImportError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    return PriceResponse(**result)


@app.post("/predict/disease", response_model=DiseaseResponse, dependencies=[Depends(api_key_guard)])
async def predict_disease(
    file: UploadFile = File(...),
    pipeline: InferencePipeline = Depends(get_inference_pipeline),
) -> DiseaseResponse:
    content = await file.read()
    max_upload = int(app_config["api"]["max_upload_bytes"])
    if len(content) > max_upload:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds max_upload_bytes={max_upload}",
        )
    try:
        result = pipeline.predict("disease", content)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except ImportError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    return DiseaseResponse(**result)
