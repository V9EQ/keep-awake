# Keep Awake

A GNOME Shell **48–51** extension that adds a **Keep Awake** tile to Quick Settings,
alongside Wi-Fi and Bluetooth. Turn it on to prevent screen dimming, blanking,
automatic locking, and automatic suspend due to inactivity in GNOME.

Turn it off to let GNOME use your usual timeouts. The mode starts off and resets
when you lock the session, disable the extension, or log out. Manual locking and
suspend, lid-close behavior, and critical-battery actions remain under system
control. No power or lock-screen settings are changed.

## Installation

From a checkout, run `make install`. Building from source requires GNU make,
Node.js for syntax checks, and the `gnome-extensions` CLI. To install without
building, download the ZIP from [Releases](https://github.com/V9EQ/keep-awake/releases/latest)
and run the following command from the download directory:

```sh
gnome-extensions install keep-awake@v9eq.github.io.shell-extension.zip
```

Log out and back in, then enable the extension:

```sh
gnome-extensions enable keep-awake@v9eq.github.io
```

Open Quick Settings from the top-right of the panel and select **Keep Awake**.
The tile is highlighted only after GNOME accepts the inhibitor. Select it again
to release it. If the session manager is unavailable, the tile cannot be turned on.

## Build and removal

`make pack` produces the bundle in `dist/` without installing it. See
[Contributing](CONTRIBUTING.md) and [Architecture](docs/architecture.md) for
checks and the GNOME compatibility review.

```sh
gnome-extensions disable keep-awake@v9eq.github.io
gnome-extensions uninstall keep-awake@v9eq.github.io
```

[GPL-2.0-or-later](LICENSE). The monitor icon is provided by the system icon
theme, with the free [Adwaita icon theme](https://gitlab.gnome.org/GNOME/adwaita-icon-theme)
as the GNOME default. No artwork is bundled.
