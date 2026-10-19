#!/bin/sh
# Install the published package through Pi's package manager.
: "${SLOPSENTRAL_PI_VERSION:?Set SLOPSENTRAL_PI_VERSION to a version from the canonical release notes}"
exec pi install "npm:slopsentral-pi@https://github.com/amichne/slopsentral/releases/download/slopsentral-v${SLOPSENTRAL_PI_VERSION}/slopsentral-pi-${SLOPSENTRAL_PI_VERSION}.tgz" "$@"
