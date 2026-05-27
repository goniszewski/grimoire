# Diagnostics and Support Bundles

Little Imp diagnostics are generated locally and are only shared when the user
chooses to copy, export, or send them. They are not telemetry.

## Generate diagnostics

From Settings:

1. Open Settings.
2. Use **Copy diagnostics** or **Export JSON** in the Diagnostics section.

From the packaged CLI:

```sh
littleimp diagnostics
littleimp diagnostics --json
littleimp diagnostics --daemon-url http://127.0.0.1:3210 --json
```

From the daemon API:

```sh
curl http://127.0.0.1:3210/diagnostics
```

## Included fields

The diagnostics payload includes:

- Little Imp version, generation timestamp, platform, bind host, and port
- detected install mode: development, native, or Docker
- data, database, settings, backup, frontend, and log file paths
- daemon status, uptime, queue depth, and retained job counts
- selected AI and embedding providers, model names, redacted base URLs, and configured status
- local backup destination status, schedule settings, and non-secret S3 target fields
- keyword, semantic, and hybrid search availability

## Omitted fields

Diagnostics never include:

- AI or embedding provider API keys
- URL credentials, query strings, or fragments from provider and S3 URLs
- app lock PIN hashes
- S3 access keys or secret keys
- encrypted backup package passwords
- bookmark contents, extracted page text, notes, or embeddings

Provider and S3 sections report whether credentials appear to be configured
without returning the credential values themselves.
