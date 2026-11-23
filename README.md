# Keep Awake

A GNOME Shell **48–51** extension that adds a **Keep Awake** tile to Quick Settings,
alongside Wi-Fi and Bluetooth. Turn it on to prevent screen dimming, blanking,
automatic locking, and automatic suspend due to inactivity in GNOME. A coffee cup
in the top panel shows when Keep Awake is active.

Turn it off to let GNOME use your usual timeouts. The mode starts off and resets
when you disable the extension or log out. No system settings are changed.

## Installation

From a checkout, run `make install`. Building from source requires GNU make,
Node.js for syntax checks, the GLib schema tools, and the `gnome-extensions` CLI.
To install without building, download the ZIP from
[Releases](https://github.com/V9EQ/keep-awake/releases/latest) and run the
following command from the download directory:

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

## Timer

Use the arrow on the tile to choose **15 minutes**, **30 minutes**, **1 hour**,
or **No timer** (the default). The countdown starts when Keep Awake turns on.
Choosing a different duration while it is on starts a new countdown; choosing
**No timer** cancels the countdown without turning Keep Awake off. The selected
duration is shown on the tile, not the remaining time.

## Settings

Open **Keep Awake Settings** from the tile menu or run
`gnome-extensions prefs keep-awake@v9eq.github.io`.

- **Allow screen blanking** (off by default): Let GNOME dim, lock, and blank the
  display at its normal timeouts while preventing automatic suspend. This does
  not turn the display off immediately. Changes apply the next time you turn on
  Keep Awake.

With screen blanking allowed, the inhibitor and any timer continue after the
session locks, but the tile and icon are hidden. In the default mode, locking
ends the active Keep Awake session. Manual locking works in both modes. With
blanking allowed, GNOME’s suspend inhibitor may also affect manual sleep,
depending on the GNOME version and system policy.

## Build and removal

`make pack` produces the bundle in `dist/` without installing it. See
[Contributing](CONTRIBUTING.md) and [Architecture](docs/architecture.md) for
checks and the GNOME compatibility review.

```sh
gnome-extensions disable keep-awake@v9eq.github.io
gnome-extensions uninstall keep-awake@v9eq.github.io
```

[GPL-2.0-or-later](LICENSE), including the bundled coffee cup icon.
