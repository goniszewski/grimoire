#!/bin/bash

trap 'echo "Received SIGINT or SIGTERM. Exiting..." >&2; exit 1' SIGINT SIGTERM

docker-compose up pocketbase &
sleep 1
bun dev

kill -- -$$