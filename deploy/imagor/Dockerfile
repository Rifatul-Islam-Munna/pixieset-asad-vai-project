FROM golang:1.24-alpine AS cache-worker-builder
WORKDIR /src
COPY worker/go.mod ./
COPY worker/main.go ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/imagor-cache-worker .

FROM shumc/imagor:latest

ENV PORT=8000 \
    IMAGOR_SIGNER_TYPE=sha256 \
    IMAGOR_SIGNER_TRUNCATE=40 \
    IMAGOR_CACHE_HEADER_TTL=600h \
    IMAGOR_CACHE_HEADER_SWR=168h \
    IMAGOR_RESULT_STORAGE_PATH_STYLE=digest \
    S3_FORCE_PATH_STYLE=1 \
    S3_HTTP_MAX_IDLE_CONNS_PER_HOST=200 \
    HTTP_LOADER_DISABLE=1 \
    GOMAXPROCS=3 \
    VIPS_CONCURRENCY=1 \
    VIPS_CACHE_SIZE=0 \
    IMAGOR_PROCESS_CONCURRENCY=4 \
    IMAGOR_PROCESS_QUEUE_SIZE=2000 \
    IMAGOR_AUTO_WEBP=1 \
    VIPS_MAX_RESOLUTION=150000000 \
    VIPS_MAX_WIDTH=16000 \
    VIPS_MAX_HEIGHT=16000 \
    AWS_EC2_METADATA_DISABLED=true \
    IMAGOR_RESPONSE_RAW_ON_ERROR=0 \
    SERVER_ACCESS_LOG=0

COPY --from=cache-worker-builder /out/imagor-cache-worker /usr/local/bin/imagor-cache-worker
COPY --chmod=755 start.sh /usr/local/bin/start-imagor-stack

EXPOSE 8000
ENTRYPOINT ["/usr/local/bin/start-imagor-stack"]
