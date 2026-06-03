"""FarmCast ML API service."""

from __future__ import annotations

import asyncio
import logging
import uuid
from dataclasses import dataclass

from fastapi import Depends, FastAPI, File, HTTPException, Request, Response, UploadFile, status

from src.api.dependencies import api_key_guard, get_app_config, get_inference_pipeline
from src.api.schemas import (
    DiseaseResponse,
    PriceRequest,
    PriceResponse,
    YieldPredictionRequest,
    YieldResponse,
)
from src.inference.yield_predictor import predict_yield, warm_up_model
from src.pipelines.inference_pipeline import InferencePipeline
from src.core.observability import configure_json_logging, log_event, monotonic


configure_json_logging()
logger = logging.getLogger("farmcast.ml.api")
app_config = get_app_config()


app = FastAPI(title=app_config["api"]["title"], version=app_config["api"]["version"])


@dataclass
class RuntimeState:
    process_started_at: float
    ready: bool = False
    startup_status: str = "starting"
    startup_error: str | None = None
    active_requests: int = 0


runtime_state = RuntimeState(process_started_at=monotonic())


log_event(
    logger,
    "process_start",
    endpoint="process",
    stage="boot",
    startup_status=runtime_state.startup_status,
)


async def _load_models_for_readiness() -> None:
    startup_start = monotonic()
    runtime_state.startup_status = "loading_models"
    log_event(logger, "fastapi_startup_begin", start=startup_start, endpoint="startup", stage="startup")
    try:
        pipeline = get_inference_pipeline()
        await asyncio.to_thread(pipeline.load_startup_models)
        await asyncio.to_thread(warm_up_model)
        runtime_state.ready = True
        runtime_state.startup_status = "ready"
        runtime_state.startup_error = None
        log_event(
            logger,
            "readiness_achieved",
            start=startup_start,
            endpoint="startup",
            stage="startup",
            ready=True,
        )
    except Exception as exc:
        runtime_state.ready = False
        runtime_state.startup_status = "failed"
        runtime_state.startup_error = str(exc)
        log_event(
            logger,
            "startup_failed",
            severity="error",
            start=startup_start,
            endpoint="startup",
            stage="startup",
            ready=False,
            exc=exc,
        )


@app.on_event("startup")
async def startup_event() -> None:
    asyncio.create_task(_load_models_for_readiness())
    log_event(
        logger,
        "server_ready_state",
        endpoint="startup",
        stage="startup",
        ready=False,
        startup_status=runtime_state.startup_status,
    )


@app.get("/")
async def root() -> dict[str, str]:
    return {"service": "farmcast-ml", "status": "ok"}


@app.head("/")
async def root_head() -> Response:
    return Response(status_code=200)


@app.get("/health")
def health() -> dict[str, str | bool | None]:
    return {
        "status": "ok" if runtime_state.ready else runtime_state.startup_status,
        "ready": runtime_state.ready,
        "error": runtime_state.startup_error,
    }


@app.get("/ready")
def ready() -> dict[str, str | bool | None]:
    status_code = status.HTTP_200_OK if runtime_state.ready else status.HTTP_503_SERVICE_UNAVAILABLE
    if not runtime_state.ready:
        raise HTTPException(
            status_code=status_code,
            detail={
                "status": runtime_state.startup_status,
                "ready": runtime_state.ready,
                "error": runtime_state.startup_error,
            },
        )
    return {"status": "ready", "ready": True, "error": None}


def _request_id(request: Request) -> str:
    return request.headers.get("x-correlation-id") or request.headers.get("x-request-id") or str(uuid.uuid4())


def _ensure_ready(request_id: str, endpoint: str) -> None:
    if runtime_state.ready:
        return
    log_event(
        logger,
        "request_rejected_not_ready",
        severity="warning",
        request_id=request_id,
        endpoint=endpoint,
        stage="readiness",
        ready=False,
        startup_status=runtime_state.startup_status,
        active_requests=runtime_state.active_requests,
    )
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=f"ML service is not ready: {runtime_state.startup_status}",
    )


@app.post("/predict/yield", response_model=YieldResponse, dependencies=[Depends(api_key_guard)])
def predict_yield_endpoint(
    http_request: Request,
    request: YieldPredictionRequest,
    pipeline: InferencePipeline = Depends(get_inference_pipeline),
) -> YieldResponse:
    request_start = monotonic()
    request_id = _request_id(http_request)
    runtime_state.active_requests += 1
    log_event(
        logger,
        "request_received",
        start=request_start,
        request_id=request_id,
        endpoint="/predict/yield",
        stage="request",
        active_requests=runtime_state.active_requests,
    )
    try:
        _ensure_ready(request_id, "/predict/yield")
        payload = request.model_dump()
        is_legacy_payload = "crop" in payload and "soil" in payload and "sowing_date" in payload
        if is_legacy_payload:
            result = predict_yield(payload)
        else:
            result = pipeline.predict("yield", payload)
    except HTTPException:
        raise
    except FileNotFoundError as exc:
        log_event(
            logger,
            "request_failed",
            severity="error",
            start=request_start,
            request_id=request_id,
            endpoint="/predict/yield",
            stage="failure",
            active_requests=runtime_state.active_requests,
            exc=exc,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except RuntimeError as exc:
        log_event(
            logger,
            "request_failed",
            severity="error",
            start=request_start,
            request_id=request_id,
            endpoint="/predict/yield",
            stage="failure",
            active_requests=runtime_state.active_requests,
            exc=exc,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except ImportError as exc:
        log_event(
            logger,
            "request_failed",
            severity="error",
            start=request_start,
            request_id=request_id,
            endpoint="/predict/yield",
            stage="failure",
            active_requests=runtime_state.active_requests,
            exc=exc,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except TypeError as exc:
        log_event(
            logger,
            "request_failed",
            severity="warning",
            start=request_start,
            request_id=request_id,
            endpoint="/predict/yield",
            stage="failure",
            active_requests=runtime_state.active_requests,
            exc=exc,
        )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except ValueError as exc:
        log_event(
            logger,
            "request_failed",
            severity="warning",
            start=request_start,
            request_id=request_id,
            endpoint="/predict/yield",
            stage="failure",
            active_requests=runtime_state.active_requests,
            exc=exc,
        )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        log_event(
            logger,
            "request_failed",
            severity="error",
            start=request_start,
            request_id=request_id,
            endpoint="/predict/yield",
            stage="failure",
            active_requests=runtime_state.active_requests,
            exc=exc,
        )
        raise
    finally:
        runtime_state.active_requests = max(0, runtime_state.active_requests - 1)

    log_event(
        logger,
        "request_completed",
        start=request_start,
        request_id=request_id,
        endpoint="/predict/yield",
        stage="response",
        active_requests=runtime_state.active_requests,
    )
    return YieldResponse(**result)


@app.post("/predict/price", response_model=PriceResponse, dependencies=[Depends(api_key_guard)])
def predict_price(
    http_request: Request,
    payload: PriceRequest,
    pipeline: InferencePipeline = Depends(get_inference_pipeline),
) -> PriceResponse:
    request_start = monotonic()
    request_id = _request_id(http_request)
    runtime_state.active_requests += 1
    log_event(
        logger,
        "request_received",
        start=request_start,
        request_id=request_id,
        endpoint="/predict/price",
        stage="request",
        active_requests=runtime_state.active_requests,
    )
    try:
        _ensure_ready(request_id, "/predict/price")
        result = pipeline.predict("price", payload.model_dump())
    except HTTPException:
        raise
    except FileNotFoundError as exc:
        log_event(
            logger,
            "request_failed",
            severity="error",
            start=request_start,
            request_id=request_id,
            endpoint="/predict/price",
            stage="failure",
            active_requests=runtime_state.active_requests,
            exc=exc,
        )
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except RuntimeError as exc:
        log_event(
            logger,
            "request_failed",
            severity="error",
            start=request_start,
            request_id=request_id,
            endpoint="/predict/price",
            stage="failure",
            active_requests=runtime_state.active_requests,
            exc=exc,
        )
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except ImportError as exc:
        log_event(
            logger,
            "request_failed",
            severity="error",
            start=request_start,
            request_id=request_id,
            endpoint="/predict/price",
            stage="failure",
            active_requests=runtime_state.active_requests,
            exc=exc,
        )
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except Exception as exc:
        log_event(
            logger,
            "request_failed",
            severity="error",
            start=request_start,
            request_id=request_id,
            endpoint="/predict/price",
            stage="failure",
            active_requests=runtime_state.active_requests,
            exc=exc,
        )
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    finally:
        runtime_state.active_requests = max(0, runtime_state.active_requests - 1)
    log_event(
        logger,
        "request_completed",
        start=request_start,
        request_id=request_id,
        endpoint="/predict/price",
        stage="response",
        active_requests=runtime_state.active_requests,
    )
    return PriceResponse(**result)


@app.post("/predict/disease", response_model=DiseaseResponse, dependencies=[Depends(api_key_guard)])
async def predict_disease(
    request: Request,
    file: UploadFile = File(...),
    pipeline: InferencePipeline = Depends(get_inference_pipeline),
) -> DiseaseResponse:
    request_start = monotonic()
    request_id = _request_id(request)
    runtime_state.active_requests += 1
    log_event(
        logger,
        "request_received",
        start=request_start,
        request_id=request_id,
        endpoint="/predict/disease",
        stage="request",
        filename=file.filename,
        content_type=file.content_type,
        active_requests=runtime_state.active_requests,
    )
    content = await file.read()
    log_event(
        logger,
        "upload_read_complete",
        start=request_start,
        request_id=request_id,
        endpoint="/predict/disease",
        stage="upload",
        upload_size_bytes=len(content),
        active_requests=runtime_state.active_requests,
    )
    max_upload = int(app_config["api"]["max_upload_bytes"])
    if len(content) > max_upload:
        runtime_state.active_requests = max(0, runtime_state.active_requests - 1)
        log_event(
            logger,
            "invalid_image_upload",
            severity="warning",
            start=request_start,
            request_id=request_id,
            endpoint="/predict/disease",
            stage="upload",
            upload_size_bytes=len(content),
            max_upload_bytes=max_upload,
            active_requests=runtime_state.active_requests,
        )
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds max_upload_bytes={max_upload}",
        )
    try:
        _ensure_ready(request_id, "/predict/disease")
        result = pipeline.predict("disease", content)
    except HTTPException:
        raise
    except FileNotFoundError as exc:
        log_event(
            logger,
            "request_failed",
            severity="error",
            start=request_start,
            request_id=request_id,
            endpoint="/predict/disease",
            stage="failure",
            upload_size_bytes=len(content),
            active_requests=runtime_state.active_requests,
            exc=exc,
        )
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except RuntimeError as exc:
        log_event(
            logger,
            "request_failed",
            severity="error",
            start=request_start,
            request_id=request_id,
            endpoint="/predict/disease",
            stage="failure",
            upload_size_bytes=len(content),
            active_requests=runtime_state.active_requests,
            exc=exc,
        )
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except ImportError as exc:
        log_event(
            logger,
            "request_failed",
            severity="error",
            start=request_start,
            request_id=request_id,
            endpoint="/predict/disease",
            stage="failure",
            upload_size_bytes=len(content),
            active_requests=runtime_state.active_requests,
            exc=exc,
        )
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except Exception as exc:
        log_event(
            logger,
            "request_failed",
            severity="error",
            start=request_start,
            request_id=request_id,
            endpoint="/predict/disease",
            stage="failure",
            upload_size_bytes=len(content),
            active_requests=runtime_state.active_requests,
            exc=exc,
        )
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    finally:
        runtime_state.active_requests = max(0, runtime_state.active_requests - 1)
    log_event(
        logger,
        "request_completed",
        start=request_start,
        request_id=request_id,
        endpoint="/predict/disease",
        stage="response",
        predicted_class=result.get("disease"),
        confidence=result.get("confidence"),
        active_requests=runtime_state.active_requests,
    )
    return DiseaseResponse(**result)
