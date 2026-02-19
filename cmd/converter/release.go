//go:build release

// release.go adds heartbeat-based auto-shutdown for compiled release binaries.
// When the browser tab closes, heartbeats stop and the server exits gracefully.
// This file is only included when building with: -tags release

package main

import (
	"log/slog"
	"net/http"
	"os"
	"strings"
	"sync/atomic"
	"time"
)

const heartbeatTimeout = 15 // seconds with no heartbeat before shutdown

var lastHeartbeat atomic.Int64

func init() {
	lastHeartbeat.Store(time.Now().UnixMilli())
}

// setupRelease registers the heartbeat endpoint and starts the watchdog.
func setupRelease(mux *http.ServeMux, shutdown chan<- os.Signal) {
	mux.HandleFunc("/api/heartbeat", func(w http.ResponseWriter, r *http.Request) {
		lastHeartbeat.Store(time.Now().UnixMilli())
		w.WriteHeader(http.StatusNoContent)
	})

	// Serve the heartbeat client script as a normal JS file (CSP-safe).
	mux.HandleFunc("/api/heartbeat.js", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/javascript")
		w.Header().Set("Cache-Control", "no-store")
		w.Write([]byte(`(function(){` +
			`var hb=setInterval(function(){` +
			`fetch("/api/heartbeat",{method:"POST"}).catch(function(){});` +
			`},5000);` +
			`window.addEventListener("beforeunload",function(){clearInterval(hb);});` +
			`})();`))
	})

	// Watchdog goroutine: waits 30s for the browser to load, then checks
	// every 5s. If no heartbeat in 15s, triggers graceful shutdown.
	go func() {
		time.Sleep(30 * time.Second)
		for {
			time.Sleep(5 * time.Second)
			silenceMs := time.Now().UnixMilli() - lastHeartbeat.Load()
			if silenceMs > int64(heartbeatTimeout*1000) {
				slog.Info("no browser heartbeat — shutting down", "silence_sec", silenceMs/1000)
				shutdown <- os.Interrupt
				return
			}
		}
	}()
}

// injectReleaseScript inserts a heartbeat <script src> before </body>.
// Uses an external script so it works with script-src 'self' CSP.
func injectReleaseScript(html string) string {
	tag := `<script src="/api/heartbeat.js"></script>`
	return strings.Replace(html, "</body>", tag+"</body>", 1)
}
