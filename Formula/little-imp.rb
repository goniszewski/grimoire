class LittleImp < Formula
  desc "Local-first bookmark manager and search daemon"
  homepage "https://github.com/goniszewski/little-imp"
  license "MIT"

  depends_on "oven-sh/bun/bun"

  if OS.mac?
    url "https://github.com/goniszewski/little-imp/releases/download/v0.1.0-beta/little-imp-0.1.0-beta-macos.tar.gz"
    sha256 "d27e19b85a55a0316e9e2700312e919223c1b4ce88262b74c11bd8e2f3ebaf59"
  elsif OS.linux?
    url "https://github.com/goniszewski/little-imp/releases/download/v0.1.0-beta/little-imp-0.1.0-beta-linux.tar.gz"
    sha256 "a1ffb52c12ed0a292ce58562ed322698b8ed43690e8260bec7dc59ea87ca8098"
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
