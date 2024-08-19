#!/bin/bash

trap 'echo "Received SIGINT or SIGTERM. Exiting..." >&2; exit 1' SIGINT SIGTERM

bun --bun run dev 

kill -- -$$