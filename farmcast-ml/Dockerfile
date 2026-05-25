FROM python:3.11-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY requirements-ml.txt .
RUN pip install --no-cache-dir -r requirements-ml.txt

COPY pyproject.toml .
COPY src/ src/
COPY configs/ configs/
COPY models/ models/

EXPOSE 5001
CMD ["uvicorn", "src.api.ml_service:app", "--host", "0.0.0.0", "--port", "5001"]
