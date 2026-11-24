# Keep Awake

A GNOME Shell **48–51** extension that adds a **Keep Awake** tile to Quick Settings,
alongside Wi-Fi and Bluetooth. Choose a power mode from the tile’s submenu
without modifying system settings. An optional coffee cup shows when the
**Keep Awake** mode is active.

## Installation

From a checkout, run `make install`. Building from source requires GNU make,
Node.js for syntax checks, the GLib schema tools, and the `gnome-extensions` CLI.
Log out and back in, then enable the extension:

```sh
gnome-extensions enable keep-awake@v9eq.github.io
```

## Power modes

Open Quick Settings from the top-right of the panel and use the arrow on the
**Keep Awake** tile:

| Mode | Behavior |
| --- | --- |
| **Keep Awake** | Prevent automatic suspend due to inactivity. Keep the display on or let it blank at GNOME’s normal timeout. Optionally stop this mode with a timer. |
| **GNOME defaults** | Leave screen, sleep, and lid behavior to GNOME. Normally it keeps the laptop awake when an external display is connected and the lid is closed. |
| **Lid sleep** | Request suspend when the lid stays closed for two seconds, even with an external display. Normal idle timeouts still apply. |

Click the main part of the tile to turn on **Keep Awake** or return to
**GNOME defaults** from either custom mode. **Lid sleep** is remembered across
logins; **Keep Awake** and its timer are not. The lid mode runs only
while the extension is loaded in a GNOME session (including the lock screen),
not at the login screen. It needs UPower, systemd-logind, and permission to
suspend without a prompt. It follows normal system sleep restrictions, does not
act on an already-closed lid at startup, and does not retry after resume.
Disable any separate lid-handling service before using this mode.

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
- **Show panel icon** (on by default): Show the coffee cup only while Keep Awake
  is active. Changes apply immediately, without affecting the tile or timer.

With screen blanking allowed, the inhibitor and any timer continue after the
session locks, but the tile and icon are hidden. With blanking disabled, locking
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
