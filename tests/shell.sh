#!/bin/sh
# SPDX-License-Identifier: GPL-2.0-or-later
set -eu

runtime=$(mktemp -d)
trap 'rm -rf "$runtime"' EXIT
export XDG_RUNTIME_DIR="$runtime" GIO_USE_VFS=local NO_AT_BRIDGE=1 LC_ALL=C.UTF-8
export XDG_DATA_HOME="$runtime/data" XDG_CACHE_HOME="$runtime/cache" XDG_CONFIG_HOME="$runtime/config"
unset WAYLAND_DISPLAY DISPLAY WAYLAND_SOCKET DBUS_SESSION_BUS_ADDRESS
ulimit -c 0

# Do not activate desktop services such as portals on the test bus.
cat > "$runtime/bus.conf" <<'EOF'
<busconfig>
  <type>session</type>
  <listen>unix:tmpdir=/tmp</listen>
  <policy context="default">
    <allow send_destination="*"/>
    <allow receive_sender="*"/>
    <allow own="*"/>
  </policy>
</busconfig>
EOF

# Point both bus types to the private test bus, never to the desktop or logind.
timeout -k 3s 30s dbus-run-session --config-file "$runtime/bus.conf" -- sh -c '
    export DBUS_SYSTEM_BUS_ADDRESS="$DBUS_SESSION_BUS_ADDRESS"
    exec gnome-shell-test-tool --headless --disable-animations --extension "$1" "$2"
' sh "$1" "$2"
