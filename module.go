package webserver

import (
	"context"
	"embed"
	"io/fs"

	"go.viam.com/rdk/logging"
	"go.viam.com/rdk/resource"
	"go.viam.com/rdk/services/generic"
)

//go:embed static/*
var staticFS embed.FS

func DistFS() (fs.FS, error) {
	return fs.Sub(staticFS, "static")
}

var Model = resource.NewModel("devrel", "claw-game", "webapp")

func init() {
	resource.RegisterService(
		generic.API,
		Model,
		resource.Registration[resource.Resource, resource.NoNativeConfig]{
			Constructor: newServer,
		})
}

func newServer(ctx context.Context, deps resource.Dependencies, config resource.Config, logger logging.Logger) (resource.Resource, error) {
	fs, err := DistFS()
	if err != nil {
		return nil, err
	}

	return NewWebModuleAndStart(config, fs, logger, config.Attributes.Int("port", 8888))
}
