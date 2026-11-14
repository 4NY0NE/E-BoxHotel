// E-BoxHotel para Windows.
// Um único .exe: serve o site do cliente (embutido) em 127.0.0.1 e abre uma janela de aplicativo do Microsoft Edge
// (modo --app, sem abas nem barra de endereço). Não instala nada, não precisa de internet para abrir o site
// (fotos e contas usam a internet quando disponível) e não expõe o site à rede: só escuta em 127.0.0.1.
package main

import (
	"embed"
	"fmt"
	"io/fs"
	"mime"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"runtime"
	"strings"
	"sync/atomic"
	"time"
)

//go:embed all:www
var embedded embed.FS

const (
	firstPort = 47831 // porta fixa: o navegador guarda os dados (contas, reservas) por endereço
	lastPort  = 47840
	marker    = "E-BoxHotel-Desktop"
)

var lastHit atomic.Int64

func handler(root fs.FS) http.Handler {
	_ = mime.AddExtensionType(".js", "text/javascript; charset=utf-8")
	_ = mime.AddExtensionType(".svg", "image/svg+xml")
	_ = mime.AddExtensionType(".webmanifest", "application/manifest+json")
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		lastHit.Store(time.Now().Unix())
		if r.URL.Path == "/__ebox" { // usado para reconhecer outra cópia já aberta
			w.Header().Set("X-App", marker)
			fmt.Fprint(w, marker)
			return
		}
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			http.Error(w, "método não permitido", http.StatusMethodNotAllowed)
			return
		}
		name := strings.TrimPrefix(path.Clean("/"+r.URL.Path), "/")
		if name == "" {
			name = "index.html"
		}
		data, err := fs.ReadFile(root, name)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		if ct := mime.TypeByExtension(path.Ext(name)); ct != "" {
			w.Header().Set("Content-Type", ct)
		}
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		if name == "sw.js" || name == "index.html" {
			w.Header().Set("Cache-Control", "no-cache")
		}
		_, _ = w.Write(data)
	})
}

func findBrowser() string {
	if runtime.GOOS != "windows" {
		for _, n := range []string{"microsoft-edge", "google-chrome", "chromium"} {
			if p, err := exec.LookPath(n); err == nil {
				return p
			}
		}
		return ""
	}
	var cands []string
	for _, env := range []string{"ProgramFiles(x86)", "ProgramFiles", "LocalAppData"} {
		if base := os.Getenv(env); base != "" {
			cands = append(cands,
				filepath.Join(base, `Microsoft\Edge\Application\msedge.exe`),
				filepath.Join(base, `Google\Chrome\Application\chrome.exe`))
		}
	}
	for _, c := range cands {
		if _, err := os.Stat(c); err == nil {
			return c
		}
	}
	return ""
}

func profileDir() string {
	base := os.Getenv("LOCALAPPDATA")
	if base == "" {
		base, _ = os.UserCacheDir()
	}
	return filepath.Join(base, "E-BoxHotel", "perfil")
}

// alreadyRunning devolve a porta de uma cópia deste aplicativo que já está aberta (ou 0).
func alreadyRunning() int {
	client := http.Client{Timeout: 700 * time.Millisecond}
	for p := firstPort; p <= lastPort; p++ {
		resp, err := client.Get(fmt.Sprintf("http://127.0.0.1:%d/__ebox", p))
		if err == nil {
			ok := resp.Header.Get("X-App") == marker
			resp.Body.Close()
			if ok {
				return p
			}
		}
	}
	return 0
}

func openWindow(browser string, port int) *exec.Cmd {
	url := fmt.Sprintf("http://127.0.0.1:%d/", port)
	if browser == "" {
		if runtime.GOOS == "windows" {
			_ = exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
		}
		return nil
	}
	cmd := exec.Command(browser,
		"--app="+url,
		"--user-data-dir="+profileDir(),
		"--no-first-run", "--no-default-browser-check",
		"--window-size=1280,860",
		"--disable-features=Translate,msEdgeShopping",
	)
	if err := cmd.Start(); err != nil {
		return nil
	}
	return cmd
}

func main() {
	browser := findBrowser()
	if p := alreadyRunning(); p != 0 { // segunda abertura: só traz a janela, sem outro servidor
		if cmd := openWindow(browser, p); cmd != nil {
			_ = cmd.Wait()
		}
		return
	}
	root, err := fs.Sub(embedded, "www")
	if err != nil {
		os.Exit(1)
	}
	var ln net.Listener
	port := 0
	for p := firstPort; p <= lastPort && ln == nil; p++ {
		if l, e := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", p)); e == nil {
			ln, port = l, p
		}
	}
	if ln == nil {
		if l, e := net.Listen("tcp", "127.0.0.1:0"); e == nil {
			ln, port = l, l.Addr().(*net.TCPAddr).Port
		} else {
			os.Exit(1)
		}
	}
	lastHit.Store(time.Now().Unix())
	srv := &http.Server{Handler: handler(root), ReadHeaderTimeout: 5 * time.Second}
	go func() { _ = srv.Serve(ln) }()

	cmd := openWindow(browser, port)
	if cmd == nil { // sem Edge/Chrome: abre o navegador padrão e encerra após 10 min sem uso
		for time.Now().Unix()-lastHit.Load() < 600 {
			time.Sleep(15 * time.Second)
		}
		return
	}
	_ = cmd.Wait()
	time.Sleep(2 * time.Second) // dá tempo de uma segunda janela assumir antes de encerrar
}
