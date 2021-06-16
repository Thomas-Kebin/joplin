#!/bin/bash

# Setup the sync parameters for user X and create a few folders and notes to
# allow sharing. Also calls the API to create the test users and clear the data.

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
ROOT_DIR="$SCRIPT_DIR/../.."

if [ "$1" == "" ]; then
	echo "User number is required"
	exit 1
fi

USER_NUM=$1
COMMANDS=($(echo $2 | tr "," "\n"))
PROFILE_DIR=~/.config/joplindev-desktop-$USER_NUM

CMD_FILE="$SCRIPT_DIR/runForSharingCommands-$USER_NUM.txt"
rm -f "$CMD_FILE"
touch "$CMD_FILE"

for CMD in "${COMMANDS[@]}"
do
    if [[ $CMD == "createUsers" ]]; then

		curl --data '{"action": "createTestUsers"}' -H 'Content-Type: application/json' http://api.joplincloud.local:22300/api/debug

	elif [[ $CMD == "createData" ]]; then
		
		echo 'mkbook "shared"' >> "$CMD_FILE"
		echo 'mkbook "other"' >> "$CMD_FILE"
		echo 'use "shared"' >> "$CMD_FILE"
		echo 'mknote "note 1"' >> "$CMD_FILE"
		echo 'mknote "note 2"' >> "$CMD_FILE"
	
	elif [[ $CMD == "reset" ]]; then
	
		USER_EMAIL="user$USER_NUM@example.com"
		rm -rf "$PROFILE_DIR"
		echo "config keychain.supported 0" >> "$CMD_FILE" 
		echo "config sync.target 10" >> "$CMD_FILE" 
		# echo "config sync.10.path http://api.joplincloud.local:22300" >> "$CMD_FILE" 
		echo "config sync.10.username $USER_EMAIL" >> "$CMD_FILE" 
		echo "config sync.10.password 123456" >> "$CMD_FILE" 
	
	elif [[ $CMD == "e2ee" ]]; then
	
		echo "e2ee enable --password 111111" >> "$CMD_FILE" 
	
	else
	
		echo "Unknown command: $CMD"
		exit 1
	
	fi
done

cd "$ROOT_DIR/packages/app-cli"
npm start -- --profile "$PROFILE_DIR" batch "$CMD_FILE"

if [[ $COMMANDS != "" ]]; then
	exit 0
fi

cd "$ROOT_DIR/packages/app-desktop"
npm start -- --profile "$PROFILE_DIR"
