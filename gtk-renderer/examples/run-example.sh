#!/usr/bin/env bash

if [ -z "$1" ]; then
    echo "Usage: $0 <example-name>"
    exit 1
fi

pushd $1
npx rollup -c rollup.config.js
gjs -m build/bundle.mjs
popd