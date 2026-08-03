class Grimoire < Formula
  desc "Local-first bookmark manager and search daemon"
  homepage "https://github.com/goniszewski/grimoire"
  license "MIT"

  depends_on "oven-sh/bun/bun"

  if OS.mac?
    url "https://github.com/goniszewski/grimoire/releases/download/v1.0.1/little-imp-1.0.1-macos.tar.gz"
    sha256 "a8c934821cc8db588ef9b3213f013c4cd99f1ae23ba8f18e400727191a9d49c1"
  elsif OS.linux?
    url "https://github.com/goniszewski/grimoire/releases/download/v1.0.1/little-imp-1.0.1-linux.tar.gz"
    sha256 "42cf4ea63bb31ea2380a0b3c8c4c65f7af943974ce1024dd9562a2484e343cff"
  end

  def install
    libexec.install "daemon", "dist", "bin", "README.md", "VERSION", "RELEASE.json", "CHECKSUMS.sha256", "SIGNING.md"
    system Formula["oven-sh/bun/bun"].opt_bin/"bun", "install", "--production", "--cwd", libexec/"daemon"

    (bin/"littleimp").write <<~EOS
      #!/bin/bash
      set -euo pipefail
      exec "#{Formula["oven-sh/bun/bun"].opt_bin}/bun" "#{opt_libexec}/daemon/src/cli.ts" "$@"
    EOS

    (bin/"littleimpd").write <<~EOS
      #!/bin/bash
      set -euo pipefail
      export HOST="${HOST:-127.0.0.1}"
      export PORT="${PORT:-3210}"
      export DATA_DIR="${DATA_DIR:-#{var}/little-imp}"
      export NODE_ENV="${NODE_ENV:-production}"
      export LOG_FORMAT="${LOG_FORMAT:-json}"
      mkdir -p "${DATA_DIR}/logs"
      cd "#{opt_libexec}/daemon"
      exec "#{Formula["oven-sh/bun/bun"].opt_bin}/bun" run "#{opt_libexec}/daemon/src/index.ts"
    EOS
  end

  def post_install
    (var/"little-imp/logs").mkpath

    env_path = var/"little-imp/.env"
    return if env_path.exist?

    env_path.write <<~EOS
      HOST=127.0.0.1
      PORT=3210
      DATA_DIR=#{var}/little-imp
      NODE_ENV=production
      LOG_FORMAT=json
    EOS
    chmod 0600, env_path
  end

  service do
    run [opt_bin/"littleimpd"]
    working_dir opt_libexec/"daemon"
    keep_alive true
    log_path var/"little-imp/logs/daemon.log"
    error_log_path var/"little-imp/logs/daemon.error.log"
    environment_variables DATA_DIR:   "#{var}/little-imp",
                          HOST:       "127.0.0.1",
                          LOG_FORMAT: "json",
                          NODE_ENV:   "production",
                          PORT:       "3210"
  end

  test do
    assert_match "littleimp #{version}", shell_output("#{bin}/littleimp --help")
  end
end
