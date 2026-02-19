# Converter

A multi-format file converter, bank file formatter, and email attachment
extractor — as a CLI tool or a self-contained web interface. All conversions
happen in memory with no temp files written to disk.

[![CI](https://github.com/avaropoint/converter/actions/workflows/ci.yml/badge.svg)](https://github.com/avaropoint/converter/actions/workflows/ci.yml)
[![Go Report Card](https://goreportcard.com/badge/github.com/avaropoint/converter)](https://goreportcard.com/report/github.com/avaropoint/converter)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Features

### File Converter
- **Image conversion** — PNG, JPEG, GIF, BMP, TIFF, WebP, ICO, SVG, HEIC, AVIF, and more (via ImageMagick)
- **Audio/Video conversion** — MP3, WAV, FLAC, OGG, AAC, MP4, MKV, AVI, WebM, MOV, and more (via FFmpeg)
- **Document conversion** — Markdown, DOCX, HTML, TXT, RTF, ODT, EPUB, and more (via Pandoc)
- **PDF text extraction** — pure Go, no external tools needed
- **Batch conversion** — queue multiple files and convert them all at once

### Bank File Formatter
- **Template-based formatting** — BeanStream_Detail (BMO), ACH_Payment, Wire_Transfer, Direct_Deposit
- **Auto-detect input** — reads both CSV and Excel (.xlsx) files
- **Multiple output formats** — fixed-width text (.txt), CSV (.csv), or Excel (.xlsx)
- **Column mapping and formatting** — fixed-width fields, padding, and trimming per template

### TNEF / Winmail.dat Extractor
- **Attachment extraction** — pull files from TNEF email attachments
- **LZFu RTF decompression** and HTML de-encapsulation from RTF
- **CID image resolution** — inline images converted to self-contained data URIs
- **External image embedding** — remote `<img>` sources fetched and inlined

### Platform
- **Modern web interface** — three-mode UI with drag-and-drop upload, file queues, and bulk download
- **CLI with multiple commands** — view, extract, body, dump, serve
- **Portable binary detection** — looks for tools in a `bin/` folder next to the executable, then falls back to system PATH
- **Pluggable format architecture** — add new formats without touching core code
- **Security hardened** — HMAC-signed session tokens, IP + device fingerprint binding, SSRF protection with DNS rebinding defense, rate limiting, strict CSP
- **Embedded web assets** — HTML, CSS, JS compiled into the binary via `go:embed`
- **Structured JSON logging** — `log/slog` with method, path, status, duration on every request
- **Hardened container** — scratch image, seccomp whitelist, memory/CPU/PID limits, read-only filesystem

## Quick Start

### Install from Source

```bash
go install github.com/avaropoint/converter/cmd/converter@latest
```

### Download Binary

Pre-built binaries for Linux, macOS, and Windows are available on the
[Releases](https://github.com/avaropoint/converter/releases) page.

### Optional External Tools

File conversion (images, audio/video, documents) requires these tools. Place
them in a `bin/` directory next to the converter binary, or install them on
your system PATH:

| Tool | Used For | Download |
|------|----------|----------|
| [ImageMagick](https://imagemagick.org/) | Image format conversion | `magick` binary + DLLs |
| [FFmpeg](https://ffmpeg.org/) | Audio/Video conversion | `ffmpeg` binary + DLLs |
| [Pandoc](https://pandoc.org/) | Document conversion | `pandoc` binary |

> **Note:** TNEF extraction, bank file formatting, and PDF text extraction work
> with no external tools — they are implemented in pure Go.

### Docker (Hardened Sandbox)

The Docker image uses a `scratch` base (zero OS) with a custom seccomp profile,
memory/CPU/PID limits, read-only filesystem, and all capabilities dropped.

> **Note:** The Docker image supports TNEF extraction and bank file formatting
> only. File conversion (images, audio, video, documents) requires the standalone
> binary with external tools in a `bin/` directory.

```bash
docker pull ghcr.io/avaropoint/converter:latest
docker run -p 8080:8080 ghcr.io/avaropoint/converter:latest
```

For full sandbox hardening (recommended for production):

```bash
docker compose up
```

See [SECURITY.md](SECURITY.md) for the complete list of container security controls.

## Usage

### Web Interface

```bash
converter serve [port]    # Default: 8080
```

Open `http://localhost:8080` in your browser, drop a file, and view or download
the extracted contents.

### CLI

```bash
converter view    <file>              # Show file summary
converter extract <file> [output_dir] # Extract attachments only
converter body    <file> [output_dir] # Extract message body only
converter dump    <file> [output_dir] # Extract everything
```

### Examples

```bash
# View what's inside a winmail.dat
converter view winmail.dat

# Extract all attachments to a folder
converter extract winmail.dat ./output

# Dump everything (body + attachments + embedded messages)
converter dump winmail.dat ./output

# Start the web interface on port 9090
converter serve 9090
```

## Architecture

```
converter
├── bin/                 External tools: magick, ffmpeg, pandoc (gitignored)
├── cmd/converter/       CLI + web server
├── cmd/inspect/         Low-level TNEF diagnostic tool
├── deploy/              Seccomp profile + deployment configs
├── formats/             Converter interface + registry
│   ├── bank/            Bank file format registration
│   ├── fileconvert/     File converter format registration
│   └── tnef/            TNEF format implementation
├── parsers/             Format-specific parsers
│   ├── bank/            CSV/Excel parsing, templates, fixed-width/CSV/XLSX output
│   ├── fileconvert/     Image, audio/video, document, PDF converters + binary discovery
│   └── tnef/            TNEF parser (MAPI, LZFu RTF, de-encapsulation)
└── web/                 Embedded static assets (go:embed)
    └── static/          HTML, CSS, JS served by the web UI
```

### Pluggable Format System

Converter uses a registry pattern for format auto-detection:

1. **Magic bytes** — each format checks file headers first
2. **Extension fallback** — matches by file extension if magic bytes don't match
3. **Auto-registration** — formats register themselves via `init()`

### Adding a New Format

Create a package under `formats/` implementing the `Converter` interface:

```go
package myformat

import "github.com/avaropoint/converter/formats"

func init() {
    formats.Register(&conv{})
}

type conv struct{}

func (c *conv) Name() string           { return "My Format" }
func (c *conv) Extensions() []string   { return []string{".myf"} }
func (c *conv) Match(data []byte) bool { return len(data) > 4 && data[0] == 0xAB }
func (c *conv) Convert(data []byte) ([]formats.ConvertedFile, error) {
    // Parse the format and return extracted files
    return nil, nil
}
```

Then add a blank import in `cmd/converter/main.go`:

```go
import _ "github.com/avaropoint/converter/formats/myformat"
```

## Development

### Prerequisites

- Go 1.25 or later
- (Optional) [ImageMagick](https://imagemagick.org/) for image conversion
- (Optional) [FFmpeg](https://ffmpeg.org/) for audio/video conversion
- (Optional) [Pandoc](https://pandoc.org/) for document conversion

### Dependencies

- [excelize/v2](https://github.com/xuri/excelize) — Excel (.xlsx) read/write for bank file formatting
- [golang.org/x/image](https://pkg.go.dev/golang.org/x/image) — Extended image format support

### Build & Test

```bash
make build    # Build binary to bin/converter
make test     # Run tests with race detection
make vet      # Run go vet
make lint     # Run staticcheck
make check    # All of the above
make run      # Build and start web server
make clean    # Remove bin/ and build artifacts
```

### Project Principles

- **Minimal dependencies** — pure Go where possible, external tools only for specialized format conversion
- **In-memory processing** — all conversions via stdin/stdout pipes, no temp files on disk
- **Single binary deployment** — web assets embedded via `go:embed`
- **Portable tool discovery** — bundled tools in `bin/` checked first, then system PATH
- **Security by default** — CSP headers, SSRF blocks, input sanitization
- **Pluggable architecture** — new formats require zero changes to existing code

## Security

See [SECURITY.md](SECURITY.md) for the full security policy.

Key protections:

| Threat | Mitigation |
|--------|-----------|
| XSS in extracted HTML | Strict CSP: `'self'` for main page, `default-src 'none'` for extracted files |
| SSRF via image URLs | DNS rebinding-safe custom dialer, redirect validation, private IP blocks |
| Header injection | Control characters stripped from filenames |
| Upload abuse | 50 MB limit via `MaxBytesReader` + rate limiting |
| Session hijacking | HMAC-SHA256 signed tokens bound to client IP + User-Agent |
| Session enumeration | 128-bit `crypto/rand` session IDs + HMAC signature verification |
| File endpoint abuse | Separate rate limiter on `/api/files/` and `/api/zip/` |
| Slowloris / connection exhaustion | Read/Write/Idle timeouts + graceful shutdown |
| Clickjacking | `X-Frame-Options: DENY` + `frame-ancestors 'none'` |
| MIME sniffing | `X-Content-Type-Options: nosniff` |
| DDoS / resource exhaustion | Memory (256 MB), CPU (1 core), PID (64), fd (4096) limits |
| Container escape | scratch image, zero capabilities, seccomp whitelist, read-only fs |
| Fork bomb | PID limit of 64 processes |
| OOM host impact | Hard memory cap prevents host RAM exhaustion |

### Production Deployment

The `docker compose up` command applies the full hardened sandbox automatically.
For internet-facing deployments, additionally place Converter behind a reverse
proxy (nginx, Caddy) that provides:

- TLS termination
- Authentication
- Additional rate limiting
- Access logging

### Logging

The web server emits structured JSON logs to stdout via Go's `log/slog`:

```json
{"time":"2026-02-13T12:00:00Z","level":"INFO","msg":"http request","method":"POST","path":"/api/convert","status":200,"duration_ms":42,"remote":"172.17.0.1:54321"}
{"time":"2026-02-13T12:00:00Z","level":"INFO","msg":"conversion complete","session":"abc123...","filename":"winmail.dat","input_bytes":196531,"output_files":5}
{"time":"2026-02-13T12:00:00Z","level":"WARN","msg":"invalid session token","remote":"10.0.0.5:12345","path":"/api/files/deadbeef.../body.html"}
```

Logs are compatible with any JSON log aggregator (ELK, Loki, CloudWatch, etc.).
Rate limit violations and invalid token attempts are logged at `WARN` level.
Startup and shutdown events at `INFO`.

### Session Security

Every conversion creates an **HMAC-SHA256 signed session token** that binds the
result to the originating client:

- **Token format**: `{128-bit-random-id}.{HMAC-SHA256-signature}`
- **HMAC key**: 256-bit, generated from `crypto/rand` at server startup (ephemeral)
- **Client fingerprint**: `SHA-256(client_ip | User-Agent)` — baked into the HMAC
- **Verification**: every file/zip request re-derives the fingerprint from the
  requesting client and validates the HMAC; mismatches return 403 Forbidden
- **Auto-expiry**: sessions are deleted after 10 minutes

To access a converted file, an attacker would need the 128-bit random session ID
**+** the 256-bit HMAC server key **+** the victim's IP address **+** the victim's
exact User-Agent string — all within the 10-minute TTL.

## Free & Open Source

This project is released under the [MIT License](LICENSE) and is **completely
free to use**. Monetization of this software or derivative works is **strictly
prohibited**. This tool is built for the community and must remain freely
available to everyone.

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

[MIT](LICENSE) — Copyright (c) 2026 Avaropoint
