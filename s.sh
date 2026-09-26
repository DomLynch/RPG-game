#!/bin/bash
S=$(dirname "$0"); $S/c.sh "$@" | while IFS= read -r l; do echo "$l" | grep -oE "^[^=]+=>|you [0-9]+ dwarf [0-9]+|gap [0-9.]+|st [0-9]+ +\| *[a-z_]+ [0-9/]+|landed|mode [a-z]+ plan [^ ]+" | tr '\n' ' '; echo; done
