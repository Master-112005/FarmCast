FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    ML_HOST=0.0.0.0 \
    ML_PORT=8000

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements-ml.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements-ml.txt

COPY configs ./configs
COPY models ./models
COPY src ./src

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD python -c "import os, urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.getenv(\"ML_PORT\", \"8000\")}/health', timeout=3)"

CMD ["sh", "-c", "uvicorn src.api.ml_service:app --host ${ML_HOST} --port ${ML_PORT}"]
