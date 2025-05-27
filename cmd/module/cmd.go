package main

import (
	webserver "claw-game"

	"go.viam.com/rdk/module"
	"go.viam.com/rdk/resource"
	"go.viam.com/rdk/services/generic"
)

func main() {
	module.ModularMain(
		resource.APIModel{API: generic.API, Model: webserver.Model},
	)
}
