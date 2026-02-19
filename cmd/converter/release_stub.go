//go:build !release

// release_stub.go provides no-op stubs for development builds.
// The release features (heartbeat shutdown, JS injection) are disabled.

package main

import (
	"net/http"
	"os"
)

func setupRelease(_ *http.ServeMux, _ chan<- os.Signal) {}

func injectReleaseScript(html string) string { return html }
