# Remote access

Grimoire is built for local use. Keep the daemon on loopback:

- Native: `127.0.0.1:3210`
- Docker: host publish `127.0.0.1:3210:3210`

Do not publish port `3210` on a public interface. Put remote access in front of loopback.

## Minimal path: SSH tunnel

On the machine that runs Grimoire, leave the daemon bound to `127.0.0.1:3210`. From another device:

```sh
ssh -N -L 3210:127.0.0.1:3210 user@grimoire-host
```

Open [http://127.0.0.1:3210](http://127.0.0.1:3210) on the client. Traffic stays encrypted in SSH; Grimoire never listens on the public network.

## Minimal path: Tailscale Serve

If both machines are on Tailscale and Grimoire listens on loopback on the host:

```sh
tailscale serve --bg 3210
```

Use the Serve URL Tailscale prints. Prefer this over opening firewall ports. Details: [Tailscale Serve](https://tailscale.com/kb/1242/tailscale-serve).

## What not to do

- Do not change Docker publish to `0.0.0.0:3210:3210` for convenience
- Do not treat Grimoire as a multi-user public web app — it is single-user and local-trust
- If you use a reverse proxy, terminate auth at the proxy or VPN and keep Grimoire on `127.0.0.1`

## Browser access through a reverse proxy

The browser-facing origin must be explicitly trusted for write requests. With
the repository Compose file, pass the exact origin when creating the container:

```sh
CORS_ORIGINS=https://grimoire.example.com docker compose up -d --force-recreate
```

Include the scheme and any non-default port. Use commas for more than one exact
origin. Paths, credentials, and wildcards are rejected. `CORS_ORIGINS` only
controls the browser origin check; it does not authenticate users, so keep
authentication at the proxy or VPN.

Threat model: [SECURITY.md](../SECURITY.md). Docker notes: [docker-deployment.md](./docker-deployment.md).
