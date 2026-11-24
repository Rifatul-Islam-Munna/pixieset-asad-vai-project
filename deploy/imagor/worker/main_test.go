package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"sync/atomic"
	"testing"
)

func TestResultStorageKeyMatchesImagorDigest(t *testing.T) {
	cfg := config{}
	got, err := resultStorageKey(cfg, "https://img.example.com/abcdefghijklmnopq/200x200/abc")
	if err != nil {
		t.Fatal(err)
	}
	want := "30/fd/be2aa5086e0f0c50ea72dd3859a10d8071ad"
	if got != want {
		t.Fatalf("result key mismatch: got %q want %q", got, want)
	}
}

func TestResultStorageKeyAddsBaseDir(t *testing.T) {
	cfg := config{resultBaseDir: "processed-v1"}
	got, err := resultStorageKey(cfg, "https://img.example.com/abcdefghijklmnopq/200x200/abc")
	if err != nil {
		t.Fatal(err)
	}
	want := "processed-v1/30/fd/be2aa5086e0f0c50ea72dd3859a10d8071ad"
	if got != want {
		t.Fatalf("result key mismatch: got %q want %q", got, want)
	}
}

func TestSharedBackendSchedulingPreservesLegacyAndSecret(t *testing.T) {
	var cursor atomic.Uint64
	primary := config{backendURL: "http://pixieset:4000", secondaryBackendURL: "http://piuphoto:4000", secret: "shared-secret"}
	first, second, third := nextBackend(primary, &cursor), nextBackend(primary, &cursor), nextBackend(primary, &cursor)
	if first.backendURL != primary.backendURL || second.backendURL != primary.secondaryBackendURL || third.backendURL != primary.backendURL {
		t.Fatal("unexpected backend scheduling")
	}
	if first.secret != primary.secret || second.secret != primary.secret || third.secret != primary.secret {
		t.Fatal("both backends must use the existing IMAGOR_SECRET")
	}
	primary.secondaryBackendURL = ""
	if nextBackend(primary, &cursor).backendURL != primary.backendURL {
		t.Fatal("legacy single backend changed")
	}
}

func TestRouterConfigKeepsLegacyBucketAndRoutesPiuphoto(t *testing.T) {
	t.Setenv("S3_LOADER_BUCKET", "pixieset-originals")
	t.Setenv("S3_LOADER_ENDPOINT", "https://primary.example")
	t.Setenv("AWS_LOADER_ACCESS_KEY_ID", "test-primary")
	t.Setenv("AWS_LOADER_SECRET_ACCESS_KEY", "test-primary-secret")
	// Only the existing loader settings are needed, even for the second bucket.
	file := filepath.Join(t.TempDir(), "routing.yaml")
	if err := writeRouterConfig(file); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(file)
	if err != nil {
		t.Fatal(err)
	}
	var cfg struct {
		Pattern string            `json:"routing_pattern"`
		Default map[string]string `json:"default_bucket"`
		Rules   []struct {
			Match  string            `json:"match"`
			Bucket map[string]string `json:"bucket"`
		} `json:"rules"`
	}
	if err := json.Unmarshal(data, &cfg); err != nil {
		t.Fatal(err)
	}
	if cfg.Default["name"] != "pixieset-originals" || cfg.Default["endpoint"] != "https://primary.example" || len(cfg.Rules) != 1 || cfg.Rules[0].Match != "piuphoto" || cfg.Rules[0].Bucket["name"] != "airpix" || cfg.Rules[0].Bucket["endpoint"] != cfg.Default["endpoint"] {
		t.Fatal("incorrect multi-bucket routing")
	}
	for _, key := range []string{"region", "endpoint", "access_key_id", "secret_access_key"} {
		if cfg.Rules[0].Bucket[key] != cfg.Default[key] {
			t.Fatalf("AirPix must reuse existing loader %s", key)
		}
	}
	pattern := regexp.MustCompile(cfg.Pattern)
	if pattern.MatchString("originals/old.jpg") || !pattern.MatchString("piuphoto/new.jpg") {
		t.Fatal("route must preserve old paths and match the PiuPhoto prefix")
	}
}
