# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.0.x   | Yes       |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT open a public issue**
2. Email security concerns to the repository maintainers via GitHub's
   [private vulnerability reporting](https://github.com/lgican/File-Converter/security/advisories/new)
3. Include a clear description of the vulnerability and steps to reproduce

We will acknowledge receipt within 48 hours and aim to provide a fix within 7 days
for critical issues.

## Security Model

Converter is a file parsing and extraction tool. Its security posture:

### What We Protect Against

- **XSS in extracted HTML**: Extracted HTML files are served with a strict
  Content-Security-Policy (`default-src 'none'; style-src 'unsafe-inline'; img-src data:`)
  that blocks all script execution. The main web UI page uses
  `default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:`
  — no inline scripts, no styles, and all source types must be explicitly allowed.
- **Static asset integrity**: Web UI assets (HTML, CSS, JS) are compiled into
  the binary via `go:embed` — no filesystem access is needed at runtime, and
  the assets cannot be tampered with after build.
- **SSRF via image inlining**: External image fetching uses a custom dialer that
  validates resolved IP addresses before connecting, preventing DNS rebinding
  attacks. Private, loopback, link-local, and cloud metadata IP ranges are
  blocked. Redirects are validated at each hop.
- **Rate limiting**: Upload endpoint (`/api/convert`) and file retrieval
  endpoints (`/api/files/`, `/api/zip/`) each have independent token-bucket
  rate limiters to prevent resource exhaustion and enumeration attempts.
- **Header injection**: Filenames from converted files are sanitized to remove
  control characters and path separators before use in HTTP headers.
- **Upload abuse**: 50 MB upload limit enforced via `MaxBytesReader`.
- **Session token security**: Sessions are protected by three layers:
  1. **128-bit cryptographic random IDs** — computationally infeasible to guess
  2. **HMAC-SHA256 signed tokens** — server-verified, unforgeable without the
     256-bit ephemeral key generated at startup
  3. **Client fingerprint binding** — HMAC covers `SHA-256(client_ip | User-Agent)`,
     tying each token to the originating device, browser, and network; tokens
     are rejected (403 Forbidden) when used from a different IP or User-Agent
- **Clickjacking**: `X-Frame-Options: DENY` and `frame-ancestors 'none'`.
- **MIME sniffing**: `X-Content-Type-Options: nosniff` on all responses.
- **Referrer leakage**: `Referrer-Policy: no-referrer` on all responses.
- **Device access**: `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  prevents access to sensitive device APIs.
- **Path traversal**: Filenames from untrusted sources are sanitized and validated
  to ensure writes stay within the intended output directory.
- **Memory safety**: Parser allocations are bounded to prevent crafted files from
  causing out-of-memory crashes.
- **Graceful shutdown**: The server handles SIGINT/SIGTERM for clean connection
  draining.
- **Structured logging**: All server events are emitted as JSON via `log/slog`.
  Every request is logged with method, path, status, duration, and remote address.
  Rate limit violations are logged at WARN level. No sensitive data (file contents,
  session payloads) is ever written to logs.

### What Is Out of Scope

- **Malware scanning**: Converter parses and extracts files but does not scan for
  viruses or malware. Extracted attachments (executables, documents, etc.) should
  be treated with the same caution as any email attachment.
- **Authentication**: The web interface has no login system. If exposed to the
  internet, place it behind a reverse proxy with authentication.
- **TLS**: The built-in server uses plain HTTP. Use a reverse proxy (nginx, Caddy)
  to terminate TLS in production.

### Production Deployment Recommendations

1. Place behind a reverse proxy with TLS termination (nginx, Caddy)
2. Add authentication if the server is internet-facing
3. Set appropriate firewall rules to restrict access
4. Monitor logs for unusual activity
