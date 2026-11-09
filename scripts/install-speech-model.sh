#!/bin/sh
# Explicit setup download from the official Vosk publisher; never run by the app.
set -eu
cd "$(dirname "$0")/.."
if [ -e models/model ]; then
  echo 'models/model already exists; preserving it.'
  exit 0
fi
mkdir -p models
archive=$(mktemp /tmp/personal-os-model.XXXXXX.zip)
trap 'rm -f "$archive"' EXIT
curl --fail --location --proto '=https' --tlsv1.2 --output "$archive" https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip
# Test archive integrity before extraction. HTTPS verification stays enabled.
unzip -t "$archive"
unzip -q "$archive" -d models
mv models/vosk-model-small-en-us-0.15 models/model
printf '%s\n' 'Model installed. Run: docker compose --profile speech up -d --build'
