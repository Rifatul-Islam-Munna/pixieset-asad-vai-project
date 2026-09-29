FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    OMP_NUM_THREADS=1 \
    OPENBLAS_NUM_THREADS=1 \
    MKL_NUM_THREADS=1 \
    NUMEXPR_NUM_THREADS=1 \
    ORT_NUM_THREADS=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    libgomp1 \
    libglib2.0-0 \
    libgl1 \
    libsm6 \
    libxext6 \
    libxrender1 \
    libxcb1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt

RUN useradd --create-home --uid 10001 appuser \
    && mkdir -p /models \
    && chown -R appuser:appuser /app /models

COPY app ./app
RUN chown -R appuser:appuser /app

USER appuser
EXPOSE 8010

# Give the model enough time to load/download on a cold boot, then continuously
# expose a real container health signal to EasyPanel/Docker.
HEALTHCHECK --interval=30s --timeout=8s --start-period=120s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8010/health', timeout=5).read()" || exit 1

# One process. The app keeps a small internal worker pool so face detection stays
# low-pressure even while the Nest API uses multiple PM2 workers.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8010", "--workers", "1", "--backlog", "128", "--timeout-keep-alive", "20"]
