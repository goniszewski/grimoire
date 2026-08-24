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

Threat model: [SECURITY.md](../SECURITY.md). Docker notes: [docker-deployment.md](./docker-deployment.md).
