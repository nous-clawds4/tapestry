#!/bin/bash

SINCE_TIMESTAMP=0
AUTHORS_FILTER=""

# --recent <seconds>  → only events newer than (now - seconds)  [recent mode]
# --author  <pubkey>  → restrict to a single author            [author mode]
while [[ $# -gt 0 ]]; do
    case "$1" in
        --recent)
            CURRENT_TIME_UNIX=$(date +"%s")
            HOW_LONG_AGO="$2"
            SINCE_TIMESTAMP=$((CURRENT_TIME_UNIX - HOW_LONG_AGO))
            shift 2
            ;;
        --author)
            AUTHORS_FILTER=", \"authors\": [\"$2\"]"
            shift 2
            ;;
        *)
            shift
            ;;
    esac
done

filter="{ \"kinds\": [1984], \"since\": $SINCE_TIMESTAMP$AUTHORS_FILTER }"

command1="strfry scan --count '$filter'"
eval "$command1"

command2="strfry scan '$filter' | jq -cr 'del(.content)' > /usr/local/lib/node_modules/brainstorm/src/pipeline/reconciliation/allKind1984EventsStripped.json"
eval "$command2"