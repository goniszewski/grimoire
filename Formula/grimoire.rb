# frozen_string_literal: true

# Install the Grimoire bookmark manager and local daemon.
class Grimoire < Formula
  desc "Local-first bookmark manager and search daemon"
  homepage "https://github.com/goniszewski/grimoire"
  license "MIT"

  depends_on "bun"

  if OS.mac?
    url "https://github.com/goniszewski/grimoire/releases/download/v1.3.1/grimoire-1.3.1-macos.tar.gz"
    sha256 "2dabf322bec523b11972778e00fcf049435458861d0974e8350a78d8ae2640c5"
  elsif OS.linux?
    url "https://github.com/goniszewski/grimoire/releases/download/v1.3.1/grimoire-1.3.1-linux.tar.gz"
    sha256 "76fac3c35a88bf97f05a3cf8babfc360e6c0f471fce864607b502bed00b639d7"
  end

  def install
    libexec.install "daemon", "dist", "bin", "README.md", "VERSION", "RELEASE.json", "CHECKSUMS.sha256", "SIGNING.md"
    bun = formula_opt_bin("bun")/"bun"
    system bun, "install", "--production", "--frozen-lockfile", "--ignore-scripts", "--cwd", libexec/"daemon"

    cli_wrapper = <<~EOS
      #!/bin/bash
      set -euo pipefail
      # Published archives may predate the CLI's package-manager guard.
      case "${1:-} ${2:-}" in
        "update install"|"update upgrade")
          echo 'Homebrew-managed installations are updated with `brew upgrade grimoire`.' >&2
          exit 2
          ;;
      esac
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

  post_install_steps do
    mkdir_p "little-imp/logs", base: :var
    unless_path_exists "little-imp/.env", base: :var do
      write_file "little-imp/.env", <<~EOS, base: :var
        HOST=127.0.0.1
        PORT=3210
        DATA_DIR={{var}}/little-imp
        NODE_ENV=production
        LOG_FORMAT=json
      EOS
      set_permissions "little-imp/.env", "0600", base: :var, recursive: false
    end
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
    update_actions = %w[install upgrade]
    %w[grimoire littleimp].each do |command|
      assert_match version.to_s, shell_output("#{bin}/#{command} --help")
      update_actions.each do |action|
        assert_match "brew upgrade grimoire", shell_output("#{bin}/#{command} update #{action} 2>&1", 2)
      end
    end
  end
end
