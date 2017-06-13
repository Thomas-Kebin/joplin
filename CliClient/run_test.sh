#!/bin/bash
CLIENT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

rm -f "$CLIENT_DIR/tests-build/src"
mkdir -p "$CLIENT_DIR/tests-build"
ln -s "$CLIENT_DIR/build/src" "$CLIENT_DIR/tests-build"

npm run build && NODE_PATH="$CLIENT_DIR/tests-build/" npm test tests-build/synchronizer.js