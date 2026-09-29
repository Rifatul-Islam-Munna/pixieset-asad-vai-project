package main

import "testing"

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
