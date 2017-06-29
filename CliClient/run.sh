#!/bin/bash
set -e
CLIENT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
bash $CLIENT_DIR/build.sh && NODE_PATH="$CLIENT_DIR/build/" node build/main.js --profile ~/Temp/TestNotes
#bash $CLIENT_DIR/build.sh && NODE_PATH="$CLIENT_DIR/build/" node build/main.js --profile ~/Temp/TestNotes import-enex --fuzzy-matching /home/laurent/Desktop/afaire.enex afaire
#bash $CLIENT_DIR/build.sh && NODE_PATH="$CLIENT_DIR/build/" node build/main.js --profile ~/Temp/TestNotes import-enex --fuzzy-matching /home/laurent/Desktop/Laurent.enex laurent