#!/usr/bin/env bash

set -euo pipefail

export PATH=$PATH:$HOME/.local/bin

curl https://mise.run | sh

mise exec node@22 -- npm install

mise exec node@22 -- npm run build
