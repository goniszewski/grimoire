class Grimoire < Formula
  desc "Local-first bookmark manager and search daemon"
  homepage "https://github.com/goniszewski/grimoire"
  license "MIT"

  depends_on "bun"

  if OS.mac?
    url "https://github.com/goniszewski/grimoire/releases/download/v1.1.0/little-imp-1.1.0-macos.tar.gz"
    sha256 "98e96cc53bebf02265c86d2014bba0d9cf9978a7bc411d041cac86bef1ce8021"
  elsif OS.linux?
    url "https://github.com/goniszewski/grimoire/releases/download/v1.1.0/little-imp-1.1.0-linux.tar.gz"
    sha256 "793c416e22173c4c825f564487d5ae704db5d3bedb99553545f7f1dad83657d7"
  end

  def install
    libexec.install "daemon", "dist", "bin", "README.md", "VERSION", "RELEASE.json", "CHECKSUMS.sha256", "SIGNING.md"
    bun = formula_opt_bin("bun")/"bun"
    system bun, "install", "--production", "--frozen-lockfile", "--cwd", libexec/"daemon"

    cli_wrapper = <<~EOS
      #!/bin/bash
      set -euo pipefail
      export LITTLEIMP_PACKAGE_MANAGER="homebrew"
      exec "#{bun}" "#{opt_libexec}/daemon/src/cli.ts" "$@"
    EOS
    (bin/"grimoire").write cli_wrapper
    (bin/"littleimp").write cli_wrapper
    (bin/"grimoire").chmod 0555
    (bin/"littleimp").chmod 0555

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
      exec "#{bun}" run "#{opt_libexec}/daemon/src/index.ts"
    EOS
    (bin/"littleimpd").chmod 0555
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

  def caveats
    <<~EOS
      Start the Grimoire daemon with:
        brew services start grimoire

      Use `brew upgrade grimoire` to update this Homebrew installation.
      Homebrew-managed data is stored under:
        #{var}/little-imp
    EOS
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
    assert_match version, shell_output("#{bin}/grimoire --help")
    assert_match version, shell_output("#{bin}/littleimp --help")
  end
end
