ARG BASE_IMAGE=ubuntu:24.04
FROM ${BASE_IMAGE}

ENV DEBIAN_FRONTEND=noninteractive
ENV container=docker

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    curl \
    dbus \
    dbus-user-session \
    procps \
    rsync \
    sudo \
    systemd \
    systemd-sysv \
    tar \
    unzip \
  && rm -rf /var/lib/apt/lists/*

RUN useradd -m -s /bin/bash smoke \
  && mkdir -p /etc/sudoers.d \
  && printf 'smoke ALL=(ALL) NOPASSWD:ALL\n' > /etc/sudoers.d/smoke \
  && chmod 0440 /etc/sudoers.d/smoke

RUN su - smoke -c 'curl -fsSL https://bun.sh/install | bash'

STOPSIGNAL SIGRTMIN+3
CMD ["/sbin/init"]
