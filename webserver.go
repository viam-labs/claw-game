package webserver

// Copied from here: https://github.com/erh/vmodutils/blob/main/web.go

import (
	"context"
	"encoding/json"
	"fmt"
	"io/fs"
	"net/http"
	"os"

	"go.viam.com/rdk/logging"
	"go.viam.com/rdk/resource"
	"go.viam.com/rdk/utils"
)

func PrepInModuleServer(cfg resource.Config, fs fs.FS, accessLog logging.Logger) (*http.ServeMux, *http.Server, error) {

	f, err := fs.Open("index.html")
	if err != nil {
		return nil, nil, fmt.Errorf("fs passed in doesn't have an index.html, probably need to fs.Sub( fs, ___ ) on the actual fs: %w", err)
	}
	f.Close()

	mux := http.NewServeMux()

	mux.Handle("/", http.FileServerFS(fs))

	mux.HandleFunc("/config.json", func(w http.ResponseWriter, r *http.Request) {
		json, err := json.Marshal(cfg)
		if err != nil {
			accessLog.Error("error marshalling data %v", err)
			http.Error(w, fmt.Sprintf("Internal Server Error: Config File Invalid %v", err), http.StatusInternalServerError)
			return
		}

		w.Header()["Content-Type"] = []string{"application/json"}
		w.Header()["Access-Control-Allow-Origin"] = []string{"*"}
		w.Write(json)
	})

	webServer := &http.Server{}
	webServer.Handler = newCookieSetter(&loggingHandler{mux, accessLog}, accessLog)

	return mux, webServer, nil
}

// ----

func newCookieSetter(handler http.Handler, logger logging.Logger) http.Handler {
	cs := &cookieSetter{handler: handler}

	cs.prepCookie(utils.MachinePartIDEnvVar, "part-id", logger)
	cs.prepCookie(utils.MachineFQDNEnvVar, "host", logger)
	cs.prepCookie(utils.APIKeyIDEnvVar, "api-key-id", logger)
	cs.prepCookie(utils.APIKeyEnvVar, "api-key", logger)

	return cs
}

type cookieSetter struct {
	handler http.Handler
	cookies []*http.Cookie
}

func (cs *cookieSetter) prepCookie(envVarName, cookieName string, logger logging.Logger) {
	v := os.Getenv(envVarName)
	if v == "" {
		logger.Warnf("no value for env: %s cookie: %s", envVarName, cookieName)
	}
	cs.cookies = append(cs.cookies, &http.Cookie{Name: cookieName, Value: v})
}

func (cs *cookieSetter) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	for _, c := range cs.cookies {
		http.SetCookie(w, c)
	}
	cs.handler.ServeHTTP(w, r)
}

// ----

type loggingHandler struct {
	handler http.Handler
	logger  logging.Logger
}

func (lh *loggingHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	lh.logger.Debugf("%s %s - %v - %v", r.Method, r.RemoteAddr, r.Header["User-Agent"], r.URL)
	lh.handler.ServeHTTP(w, r)
}

// ----

func NewWebModuleAndStart(cfg resource.Config, fs fs.FS, logger logging.Logger, port int) (resource.Resource, error) {
	m, err := NewWebModule(cfg, fs, logger)
	if err != nil {
		return nil, err
	}

	err = m.Start(port)
	if err != nil {
		return nil, err
	}

	return m, nil
}

func NewWebModule(cfg resource.Config, fs fs.FS, logger logging.Logger) (*webModule, error) {
	accessLog := logger.Sublogger("accessLog")

	_, s, err := PrepInModuleServer(cfg, fs, accessLog)
	if err != nil {
		return nil, err
	}

	wm := &webModule{
		cfg:    cfg,
		server: s,
		logger: logger,
	}

	return wm, nil
}

type webModule struct {
	resource.AlwaysRebuild

	cfg    resource.Config
	logger logging.Logger

	server *http.Server
}

func (wm *webModule) Start(port int) error {
	wm.server.Addr = fmt.Sprintf(":%d", port)
	wm.logger.Infof("going to listen on %v", wm.server.Addr)
	go func() {
		err := wm.server.ListenAndServe()
		if err != nil {
			wm.logger.Errorf("error ListenAndServe: %v", err)
		}
	}()
	return nil
}

func (wm *webModule) Name() resource.Name {
	return wm.cfg.ResourceName()
}

func (wm *webModule) Close(ctx context.Context) error {
	return wm.server.Close()
}

func (wm *webModule) DoCommand(ctx context.Context, cmd map[string]interface{}) (map[string]interface{}, error) {
	return nil, nil
}
