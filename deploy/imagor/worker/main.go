package main

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha1"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path"
	"strconv"
	"strings"
	"time"
)

var variants = []string{"small", "view"}
var workerLogEnabled bool

type config struct {
	backendURL      string
	imagorLocalURL  string
	secret          string
	logEnabled      bool
	resultEndpoint  string
	resultBucket    string
	resultBaseDir   string
	resultPublicURL string
	resultRegion    string
	accessKey       string
	secretKey       string
	interval        time.Duration
	idlePoll        time.Duration
	concurrency     int
	cloudflareZone  string
	cloudflareToken string
}

type warmJob struct {
	ImageID      string            `json:"imageId"`
	CollectionID string            `json:"collectionId"`
	Version      int               `json:"version"`
	URLs         map[string]string `json:"urls"`
}

type deleteJob struct {
	JobID         string   `json:"jobId"`
	ImageID       string   `json:"imageId"`
	CollectionID  string   `json:"collectionId"`
	Keys          []string `json:"keys"`
	URLs          []string `json:"urls"`
	TransformURLs []string `json:"transformUrls"`
}

type warmComplete struct {
	Accepted     bool     `json:"accepted"`
	Ready        bool     `json:"ready"`
	ObsoleteKeys []string `json:"obsoleteKeys"`
	ObsoleteURLs []string `json:"obsoleteUrls"`
}

func main() {
	workerLogEnabled = envBool("IMAGOR_CACHE_WORKER_LOG_ENABLED", false)
	if !envBool("IMAGOR_CACHE_WORKER_ENABLED", true) {
		workerLogf("imagor cache worker disabled")
		return
	}
	cfg, err := loadConfig()
	if err != nil {
		workerLogf("imagor cache worker disabled: %v", err)
		return
	}
	waitForImagor(cfg)

	workerLogf(
		"imagor cache worker started: backend=%s bucket=%s interval=%s concurrency=%d debugLogs=%t",
		cfg.backendURL,
		cfg.resultBucket,
		cfg.interval,
		cfg.concurrency,
		cfg.logEnabled,
	)
	tracef(
		cfg,
		"runtime config: imagorLocal=%s sourceBucket=%s sourceEndpoint=%s sourceRegion=%s resultBucket=%s resultEndpoint=%s resultPublicURL=%s resultRegion=%s resultBaseDir=%s signer=%s truncate=%s",
		cfg.imagorLocalURL,
		env("S3_LOADER_BUCKET", "<missing>"),
		env("S3_LOADER_ENDPOINT", "<missing>"),
		env("AWS_LOADER_REGION", "auto"),
		cfg.resultBucket,
		cfg.resultEndpoint,
		cfg.resultPublicURL,
		cfg.resultRegion,
		cfg.resultBaseDir,
		env("IMAGOR_SIGNER_TYPE", "sha256"),
		env("IMAGOR_SIGNER_TRUNCATE", "40"),
	)
	for workerID := 1; workerID <= cfg.concurrency; workerID++ {
		go warmLoop(cfg, workerID)
	}

	// Keep delete cleanup independent from warming so removing images never has
	// to wait behind a long gallery-cache backlog.
	for {
		deleted := processDelete(cfg)
		if deleted {
			time.Sleep(250 * time.Millisecond)
		} else {
			time.Sleep(cfg.idlePoll)
		}
	}
}

func waitForImagor(cfg config) {
	healthURL := strings.TrimRight(cfg.imagorLocalURL, "/") + "/healthcheck"
	tracef(cfg, "waiting for Imagor healthcheck: url=%s", healthURL)
	for {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, healthURL, nil)
		if err == nil {
			resp, requestErr := http.DefaultClient.Do(req)
			if requestErr == nil {
				_, _ = io.Copy(io.Discard, resp.Body)
				_ = resp.Body.Close()
				if resp.StatusCode >= 200 && resp.StatusCode < 300 {
					tracef(cfg, "Imagor healthcheck ready: status=%d", resp.StatusCode)
					cancel()
					return
				}
				tracef(cfg, "Imagor healthcheck not ready: status=%d", resp.StatusCode)
			} else {
				tracef(cfg, "Imagor healthcheck failed: %v", requestErr)
			}
		}
		cancel()
		time.Sleep(time.Second)
	}
}

func loadConfig() (config, error) {
	cfg := config{
		backendURL:      strings.TrimRight(env("BACKEND_INTERNAL_URL", ""), "/"),
		imagorLocalURL:  strings.TrimRight(env("IMAGOR_LOCAL_URL", "http://127.0.0.1:8000"), "/"),
		secret:          strings.TrimSpace(env("IMAGOR_SECRET", "")),
		logEnabled:      envBool("IMAGOR_CACHE_WORKER_LOG_ENABLED", false),
		resultEndpoint:  strings.TrimRight(env("S3_RESULT_STORAGE_ENDPOINT", ""), "/"),
		resultBucket:    strings.TrimSpace(env("S3_RESULT_STORAGE_BUCKET", "")),
		resultBaseDir:   strings.Trim(env("S3_RESULT_STORAGE_BASE_DIR", ""), "/"),
		resultPublicURL: strings.TrimRight(env("S3_RESULT_STORAGE_PUBLIC_URL", ""), "/"),
		resultRegion:    env("AWS_RESULT_STORAGE_REGION", "auto"),
		accessKey:       strings.TrimSpace(env("AWS_RESULT_STORAGE_ACCESS_KEY_ID", "")),
		secretKey:       strings.TrimSpace(env("AWS_RESULT_STORAGE_SECRET_ACCESS_KEY", "")),
		interval:        envDuration("IMAGOR_CACHE_WORKER_INTERVAL", 250*time.Millisecond),
		idlePoll:        envDuration("IMAGOR_CACHE_WORKER_IDLE_POLL", 2*time.Second),
		concurrency:     envInt("IMAGOR_CACHE_WORKER_CONCURRENCY", 2),
		cloudflareZone:  strings.TrimSpace(env("CLOUDFLARE_ZONE_ID", "")),
		cloudflareToken: strings.TrimSpace(env("CLOUDFLARE_API_TOKEN", "")),
	}

	if style := strings.ToLower(env("IMAGOR_RESULT_STORAGE_PATH_STYLE", "digest")); style != "digest" {
		return cfg, fmt.Errorf("IMAGOR_RESULT_STORAGE_PATH_STYLE must be digest, got %q", style)
	}
	if cfg.backendURL == "" || cfg.secret == "" {
		return cfg, errors.New("BACKEND_INTERNAL_URL and IMAGOR_SECRET are required")
	}
	if cfg.resultEndpoint == "" || cfg.resultBucket == "" || cfg.resultPublicURL == "" {
		missing := []string{}
		if cfg.resultEndpoint == "" {
			missing = append(missing, "S3_RESULT_STORAGE_ENDPOINT")
		}
		if cfg.resultBucket == "" {
			missing = append(missing, "S3_RESULT_STORAGE_BUCKET")
		}
		if cfg.resultPublicURL == "" {
			missing = append(missing, "S3_RESULT_STORAGE_PUBLIC_URL")
		}
		return cfg, fmt.Errorf("missing required Imagor cache worker env: %s", strings.Join(missing, ", "))
	}
	if cfg.accessKey == "" || cfg.secretKey == "" {
		return cfg, errors.New("AWS result-storage credentials are required")
	}
	if cfg.interval < 100*time.Millisecond {
		cfg.interval = 100 * time.Millisecond
	}
	if cfg.idlePoll < 500*time.Millisecond {
		cfg.idlePoll = 500 * time.Millisecond
	}
	if cfg.concurrency < 1 {
		cfg.concurrency = 1
	}
	if cfg.concurrency > 4 {
		cfg.concurrency = 4
	}
	return cfg, nil
}

func warmLoop(cfg config, workerID int) {
	for {
		tracef(cfg, "warm worker poll started: worker=%d", workerID)
		warmed := processWarm(cfg)
		tracef(cfg, "warm worker poll finished: worker=%d warmJob=%t", workerID, warmed)
		if warmed {
			time.Sleep(cfg.interval)
		} else {
			time.Sleep(cfg.idlePoll)
		}
	}
}

func processWarm(cfg config) bool {
	tracef(cfg, "requesting warm job from backend")
	var response struct {
		Data *warmJob `json:"data"`
	}
	if err := postJSON(cfg, "/internal/imagor-cache/claim", map[string]any{}, &response); err != nil {
		workerLogf("cache claim failed: %v", err)
		return false
	}
	if response.Data == nil {
		tracef(cfg, "no eligible warm job returned")
		return false
	}

	job := response.Data
	jobStarted := time.Now()
	tracef(
		cfg,
		"warm job claimed: image=%s gallery=%s version=%d variants=%d",
		job.ImageID,
		job.CollectionID,
		job.Version,
		len(variants),
	)
	keys := make(map[string]string, len(variants))
	publicURLs := make(map[string]string, len(variants))
	for _, variant := range variants {
		rawURL := strings.TrimSpace(job.URLs[variant])
		if rawURL == "" {
			failWarm(cfg, job, fmt.Errorf("missing %s URL", variant))
			return true
		}
		tracef(cfg, "variant started: image=%s variant=%s", job.ImageID, variant)
		key, publicURL, err := warmAndVerify(cfg, rawURL)
		if err != nil {
			failWarm(cfg, job, fmt.Errorf("%s: %w", variant, err))
			return true
		}
		keys[variant] = key
		publicURLs[variant] = publicURL
		tracef(
			cfg,
			"variant cached: image=%s variant=%s key=%s",
			job.ImageID,
			variant,
			key,
		)
	}

	var completed struct {
		Data warmComplete `json:"data"`
	}
	payload := map[string]any{
		"collectionId": job.CollectionID,
		"success":      true,
		"keys":         keys,
		"urls":         publicURLs,
	}
	endpoint := "/internal/imagor-cache/complete/" + url.PathEscape(job.ImageID)
	tracef(cfg, "sending completion callback: image=%s", job.ImageID)
	if err := postJSON(cfg, endpoint, payload, &completed); err != nil {
		workerLogf("cache completion callback failed for %s: %v", job.ImageID, err)
		return true
	}

	if !completed.Data.Accepted {
		_ = deleteResultObjects(cfg, mapValues(keys), mapValues(publicURLs))
		return true
	}
	if len(completed.Data.ObsoleteKeys) > 0 {
		if err := deleteResultObjects(cfg, completed.Data.ObsoleteKeys, completed.Data.ObsoleteURLs); err != nil {
			workerLogf("obsolete result-cache cleanup failed: %v", err)
		}
	}
	workerLogf(
		"imagor result cache ready: image=%s gallery=%s galleryReady=%t duration=%s",
		job.ImageID,
		job.CollectionID,
		completed.Data.Ready,
		time.Since(jobStarted).Round(time.Millisecond),
	)
	return true
}

func failWarm(cfg config, job *warmJob, cause error) {
	payload := map[string]any{
		"collectionId": job.CollectionID,
		"success":      false,
		"error":        cause.Error(),
	}
	endpoint := "/internal/imagor-cache/complete/" + url.PathEscape(job.ImageID)
	var ignored any
	if err := postJSON(cfg, endpoint, payload, &ignored); err != nil {
		workerLogf("cache failure callback failed for %s: %v", job.ImageID, err)
	}
	workerLogf("imagor result cache warm failed: image=%s error=%v", job.ImageID, cause)
}

func processDelete(cfg config) bool {
	var response struct {
		Data *deleteJob `json:"data"`
	}
	if err := postJSON(cfg, "/internal/imagor-cache/delete/claim", map[string]any{}, &response); err != nil {
		workerLogf("cache delete claim failed: %v", err)
		return false
	}
	if response.Data == nil {
		tracef(cfg, "no cache delete job returned")
		return false
	}
	job := response.Data
	keys := append([]string{}, job.Keys...)
	publicURLs := append([]string{}, job.URLs...)

	// On-demand thumbnails are never pre-registered as permanent cache rows.
	// Their signed Imagor URL is enough to deterministically derive the Result
	// Storage key, so delete still removes every cached copy of the image.
	for _, rawURL := range job.TransformURLs {
		key, keyErr := resultStorageKey(cfg, rawURL)
		if keyErr != nil {
			workerLogf("cache transform delete key failed for %s: %v", job.ImageID, keyErr)
			continue
		}
		keys = append(keys, key)
		publicURLs = append(publicURLs, publicResultURL(cfg, key))
	}

	tracef(
		cfg,
		"delete job claimed: job=%s image=%s objects=%d transforms=%d",
		job.JobID,
		job.ImageID,
		len(keys),
		len(job.TransformURLs),
	)
	err := deleteResultObjects(cfg, keys, publicURLs)
	payload := map[string]any{"success": err == nil}
	if err != nil {
		payload["error"] = err.Error()
	}
	endpoint := "/internal/imagor-cache/delete/complete/" + url.PathEscape(job.JobID)
	var ignored any
	if callbackErr := postJSON(cfg, endpoint, payload, &ignored); callbackErr != nil {
		workerLogf("cache delete callback failed for %s: %v", job.JobID, callbackErr)
	}
	if err != nil {
		workerLogf("imagor result cache delete failed: job=%s error=%v", job.JobID, err)
	} else {
		workerLogf("imagor result cache deleted: job=%s image=%s", job.JobID, job.ImageID)
	}
	return true
}

func warmAndVerify(cfg config, rawURL string) (string, string, error) {
	key, err := resultStorageKey(cfg, rawURL)
	if err != nil {
		return "", "", err
	}

	localURL, err := rewriteImagorURL(cfg.imagorLocalURL, rawURL)
	if err != nil {
		return "", "", err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()
	requestStarted := time.Now()
	tracef(cfg, "Imagor transform request started: resultKey=%s", key)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, localURL, nil)
	if err != nil {
		return "", "", err
	}
	// Keep cache warming format-neutral. Advertising AVIF/WebP makes Imagor's
	// auto-format feature rewrite the processing path, producing a different
	// digest key from the signed URL key that this worker verifies and publishes.
	req.Header.Set("Accept", "image/*,*/*;q=0.8")
	req.Header.Set("User-Agent", "gallerista-imagor-r2-worker/1.0")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", "", err
	}
	responseBytes, copyErr := io.Copy(io.Discard, resp.Body)
	closeErr := resp.Body.Close()
	tracef(
		cfg,
		"Imagor transform response: status=%d contentType=%q bytes=%d duration=%s resultKey=%s",
		resp.StatusCode,
		resp.Header.Get("Content-Type"),
		responseBytes,
		time.Since(requestStarted).Round(time.Millisecond),
		key,
	)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", "", fmt.Errorf("imagor returned HTTP %d", resp.StatusCode)
	}
	if copyErr != nil {
		return "", "", copyErr
	}
	if closeErr != nil {
		return "", "", closeErr
	}

	var headErr error
	for attempt := 0; attempt < 6; attempt++ {
		tracef(cfg, "R2 verify started: attempt=%d key=%s", attempt+1, key)
		headErr = s3Request(cfg, http.MethodHead, key)
		if headErr == nil {
			tracef(cfg, "R2 verify succeeded: attempt=%d key=%s", attempt+1, key)
			break
		}
		tracef(cfg, "R2 verify failed: attempt=%d key=%s error=%v", attempt+1, key, headErr)
		time.Sleep(time.Duration(attempt+1) * 350 * time.Millisecond)
	}
	if headErr != nil {
		return "", "", fmt.Errorf("R2 Result Storage did not confirm %s: %w", key, headErr)
	}
	return key, publicResultURL(cfg, key), nil
}

func resultStorageKey(cfg config, rawURL string) (string, error) {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return "", err
	}
	escaped := strings.TrimPrefix(parsed.EscapedPath(), "/")
	firstSlash := strings.IndexByte(escaped, '/')
	if firstSlash < 0 || firstSlash == len(escaped)-1 {
		return "", errors.New("invalid signed Imagor path")
	}
	processingPath := escaped[firstSlash+1:]
	sum := sha1.Sum([]byte(processingPath))
	hash := hex.EncodeToString(sum[:])
	logicalKey := hash[:2] + "/" + hash[2:4] + "/" + hash[4:]
	if cfg.resultBaseDir == "" {
		return logicalKey, nil
	}
	return path.Join(cfg.resultBaseDir, logicalKey), nil
}

func rewriteImagorURL(localBase, rawURL string) (string, error) {
	source, err := url.Parse(rawURL)
	if err != nil {
		return "", err
	}
	local, err := url.Parse(localBase)
	if err != nil {
		return "", err
	}
	source.Scheme = local.Scheme
	source.Host = local.Host
	if local.Path != "" && local.Path != "/" {
		source.Path = strings.TrimRight(local.Path, "/") + "/" + strings.TrimLeft(source.Path, "/")
		source.RawPath = ""
	}
	return source.String(), nil
}

func publicResultURL(cfg config, key string) string {
	return cfg.resultPublicURL + "/" + escapeKey(key)
}

func deleteResultObjects(cfg config, keys, publicURLs []string) error {
	seen := map[string]struct{}{}
	for _, key := range keys {
		key = strings.Trim(strings.TrimSpace(key), "/")
		if key == "" {
			continue
		}
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		if err := s3Request(cfg, http.MethodDelete, key); err != nil {
			return err
		}
	}
	if err := purgeCloudflare(cfg, publicURLs); err != nil {
		return err
	}
	return nil
}

func s3Request(cfg config, method, key string) error {
	escapedPath := "/" + url.PathEscape(cfg.resultBucket) + "/" + escapeKey(key)
	requestURL := cfg.resultEndpoint + escapedPath
	req, err := http.NewRequest(method, requestURL, nil)
	if err != nil {
		return err
	}
	now := time.Now().UTC()
	amzDate := now.Format("20060102T150405Z")
	dateStamp := now.Format("20060102")
	emptyHash := sha256.Sum256(nil)
	payloadHash := hex.EncodeToString(emptyHash[:])
	host := req.URL.Host

	canonicalHeaders := "host:" + host + "\n" +
		"x-amz-content-sha256:" + payloadHash + "\n" +
		"x-amz-date:" + amzDate + "\n"
	signedHeaders := "host;x-amz-content-sha256;x-amz-date"
	canonicalRequest := method + "\n" + escapedPath + "\n\n" +
		canonicalHeaders + "\n" + signedHeaders + "\n" + payloadHash
	requestHash := sha256.Sum256([]byte(canonicalRequest))
	scope := dateStamp + "/" + cfg.resultRegion + "/s3/aws4_request"
	stringToSign := "AWS4-HMAC-SHA256\n" + amzDate + "\n" + scope + "\n" +
		hex.EncodeToString(requestHash[:])

	kDate := hmacSHA256([]byte("AWS4"+cfg.secretKey), dateStamp)
	kRegion := hmacSHA256(kDate, cfg.resultRegion)
	kService := hmacSHA256(kRegion, "s3")
	kSigning := hmacSHA256(kService, "aws4_request")
	signature := hex.EncodeToString(hmacSHA256(kSigning, stringToSign))
	authorization := "AWS4-HMAC-SHA256 Credential=" + cfg.accessKey + "/" + scope +
		", SignedHeaders=" + signedHeaders + ", Signature=" + signature

	req.Header.Set("x-amz-content-sha256", payloadHash)
	req.Header.Set("x-amz-date", amzDate)
	req.Header.Set("Authorization", authorization)

	client := &http.Client{Timeout: 20 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, resp.Body)
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return nil
	}
	return fmt.Errorf("R2 %s %s returned HTTP %d", method, key, resp.StatusCode)
}

func purgeCloudflare(cfg config, publicURLs []string) error {
	if cfg.cloudflareZone == "" || cfg.cloudflareToken == "" || len(publicURLs) == 0 {
		return nil
	}
	unique := make([]string, 0, len(publicURLs))
	seen := map[string]struct{}{}
	for _, item := range publicURLs {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		if _, ok := seen[item]; ok {
			continue
		}
		seen[item] = struct{}{}
		unique = append(unique, item)
	}

	for start := 0; start < len(unique); start += 30 {
		end := start + 30
		if end > len(unique) {
			end = len(unique)
		}
		payload, _ := json.Marshal(map[string]any{"files": unique[start:end]})
		apiURL := "https://api.cloudflare.com/client/v4/zones/" +
			url.PathEscape(cfg.cloudflareZone) + "/purge_cache"
		req, err := http.NewRequest(http.MethodPost, apiURL, bytes.NewReader(payload))
		if err != nil {
			return err
		}
		req.Header.Set("Authorization", "Bearer "+cfg.cloudflareToken)
		req.Header.Set("Content-Type", "application/json")
		client := &http.Client{Timeout: 15 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			return err
		}
		_, _ = io.Copy(io.Discard, resp.Body)
		resp.Body.Close()
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			return fmt.Errorf("Cloudflare purge returned HTTP %d", resp.StatusCode)
		}
	}
	return nil
}

func postJSON(cfg config, endpoint string, payload any, out any) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		cfg.backendURL+endpoint,
		bytes.NewReader(body),
	)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-imagor-worker-secret", cfg.secret)
	client := &http.Client{Timeout: 20 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(io.LimitReader(resp.Body, 2*1024*1024))
	if err != nil {
		return err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("backend returned HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(data)))
	}
	if out == nil || len(data) == 0 {
		return nil
	}
	return json.Unmarshal(data, out)
}

func escapeKey(key string) string {
	parts := strings.Split(strings.Trim(key, "/"), "/")
	for i := range parts {
		parts[i] = url.PathEscape(parts[i])
	}
	return strings.Join(parts, "/")
}

func mapValues(values map[string]string) []string {
	out := make([]string, 0, len(values))
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			out = append(out, value)
		}
	}
	return out
}

func hmacSHA256(key []byte, value string) []byte {
	mac := hmac.New(sha256.New, key)
	_, _ = mac.Write([]byte(value))
	return mac.Sum(nil)
}

func env(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func envBool(key string, fallback bool) bool {
	raw := strings.ToLower(strings.TrimSpace(os.Getenv(key)))
	if raw == "" {
		return fallback
	}
	switch raw {
	case "1", "true", "yes", "on":
		return true
	case "0", "false", "no", "off":
		return false
	default:
		return fallback
	}
}

func envDuration(key string, fallback time.Duration) time.Duration {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}
	value, err := time.ParseDuration(raw)
	if err != nil {
		workerLogf("invalid %s=%q, using %s", key, raw, fallback)
		return fallback
	}
	return value
}

func envInt(key string, fallback int) int {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}
	value, err := strconv.Atoi(raw)
	if err != nil {
		workerLogf("invalid %s=%q, using %d", key, raw, fallback)
		return fallback
	}
	return value
}

func workerLogf(format string, args ...any) {
	if !workerLogEnabled {
		return
	}
	log.Printf(format, args...)
}

func tracef(cfg config, format string, args ...any) {
	if !cfg.logEnabled {
		return
	}
	workerLogf("imagor cache debug: "+format, args...)
}
