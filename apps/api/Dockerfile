# FundsLink API — dev image (Stage-00 scaffold). Liveness only.
FROM python:3.12-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

# Runtime deps only (scaffold). Locked, expanded in later stages.
RUN pip install --upgrade pip \
    && pip install "fastapi>=0.111" "uvicorn[standard]>=0.30" "pydantic>=2.7" "pydantic-settings>=2.3"

COPY app ./app

EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/healthz').status==200 else 1)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
