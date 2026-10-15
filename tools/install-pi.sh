#!/bin/sh
# Install the published package through Pi's package manager.
exec pi install 'npm:slopsentral-pi@https://github.com/amichne/slopsentral/releases/download/pi-v0.1.0/slopsentral-pi-0.1.0.tgz' "$@"
