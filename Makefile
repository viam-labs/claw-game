module.tar.gz: bin/webserver meta.json
	tar czf module.tar.gz bin/webserver meta.json

bin/webserver: lint *.go cmd/module/*.go *.mod Makefile static/main.js static/index.html
	go build -o bin/webserver cmd/module/cmd.go

lint:
	gofmt -w .

updaterdk:
	go get go.viam.com/rdk@latest
	go mod tidy

clean:
	rm -rf bin
	rm -rf node_modules
	rm -f module.tar.gz
	rm -f static/main.js
