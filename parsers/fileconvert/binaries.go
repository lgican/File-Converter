// Package fileconvert handles finding system-installed binaries.
//
// The converter relies on external tools (ImageMagick, FFmpeg, Pandoc) that
// must be installed on the host. Discovery order:
//  1. System PATH (works on every OS if the tool is installed normally)
//  2. Well-known OS-specific install locations as fallback
package fileconvert

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
)

// findBinary searches for an executable on the system PATH first, then
// checks common OS-specific install directories as a fallback.
func findBinary(name string) (string, bool) {
	// On Windows the shell needs the .exe suffix.
	if runtime.GOOS == "windows" && filepath.Ext(name) != ".exe" {
		name = name + ".exe"
	}

	// 1. System PATH — covers every OS when the tool is installed normally.
	if p, err := exec.LookPath(name); err == nil {
		return p, true
	}

	// 2. Well-known fallback directories for this OS + tool.
	for _, dir := range defaultDirs(name) {
		p := filepath.Join(dir, name)
		if _, err := os.Stat(p); err == nil {
			return p, true
		}
	}

	return "", false
}

// defaultDirs returns a list of directories where a given binary is commonly
// installed, ordered from most to least likely, for the current OS.
func defaultDirs(name string) []string {
	// Strip .exe so the switch works on the base name.
	base := name
	if ext := filepath.Ext(name); ext == ".exe" {
		base = name[:len(name)-len(ext)]
	}

	switch runtime.GOOS {
	case "linux":
		return linuxDirs(base)
	case "darwin":
		return darwinDirs(base)
	case "windows":
		return windowsDirs(base)
	default:
		return nil
	}
}

// ── Linux ──────────────────────────────────────────────────────────────────

func linuxDirs(base string) []string {
	common := []string{
		"/usr/bin",
		"/usr/local/bin",
		"/snap/bin",
	}
	switch base {
	case "magick":
		return append(common, "/usr/lib/ImageMagick-7/bin")
	case "ffmpeg":
		return common
	case "pandoc":
		return append(common, "/opt/pandoc/bin")
	case "pdftotext":
		return common // poppler-utils
	default:
		return common
	}
}

// ── macOS ──────────────────────────────────────────────────────────────────

func darwinDirs(base string) []string {
	// Homebrew installs to /opt/homebrew/bin on Apple Silicon, /usr/local/bin
	// on Intel Macs. MacPorts uses /opt/local/bin.
	common := []string{
		"/opt/homebrew/bin",
		"/usr/local/bin",
		"/opt/local/bin",
	}
	switch base {
	case "magick":
		return append(common,
			"/opt/homebrew/opt/imagemagick/bin",
			"/usr/local/opt/imagemagick/bin",
		)
	case "ffmpeg":
		return append(common,
			"/opt/homebrew/opt/ffmpeg/bin",
			"/usr/local/opt/ffmpeg/bin",
		)
	case "pandoc":
		return append(common,
			"/opt/homebrew/opt/pandoc/bin",
			"/usr/local/opt/pandoc/bin",
		)
	case "pdftotext":
		return append(common,
			"/opt/homebrew/opt/poppler/bin",
			"/usr/local/opt/poppler/bin",
		)
	default:
		return common
	}
}

// ── Windows ────────────────────────────────────────────────────────────────

func windowsDirs(base string) []string {
	pf := os.Getenv("ProgramFiles")
	if pf == "" {
		pf = `C:\Program Files`
	}

	switch base {
	case "magick":
		return globDirs(
			filepath.Join(pf, "ImageMagick*"),
		)
	case "ffmpeg":
		return []string{
			filepath.Join(pf, "ffmpeg", "bin"),
			`C:\ffmpeg\bin`,
		}
	case "pandoc":
		return []string{
			filepath.Join(pf, "Pandoc"),
			filepath.Join(os.Getenv("LOCALAPPDATA"), "Pandoc"),
		}
	case "pdftotext":
		return globDirs(
			filepath.Join(pf, "poppler*", "Library", "bin"),
			filepath.Join(pf, "xpdf*"),
		)
	default:
		return nil
	}
}

// globDirs expands glob patterns and returns the matched directories.
func globDirs(patterns ...string) []string {
	var dirs []string
	for _, pat := range patterns {
		matches, _ := filepath.Glob(pat)
		dirs = append(dirs, matches...)
	}
	return dirs
}

// isCommandAvailable checks if a command is available on the system.
func isCommandAvailable(name string) bool {
	_, found := findBinary(name)
	return found
}
