#!/bin/sh
set -eu
node server/migrate.js
exec node server/index.js
