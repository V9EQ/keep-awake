# Keep Awake

A GNOME Shell **48–51** extension for preventing automatic suspend from Quick Settings.

## Installation

From a checkout, run `make install`. This requires GNU Make, Node.js, the GLib
schema tools, and `gnome-extensions`. Log out and back in, then enable the extension:

```sh
gnome-extensions enable keep-awake@v9eq.github.io
```

## Usage

Click the **Keep Awake** tile to switch between **Standard** and **Caffeine**.
The arrow opens the mode selector, timer, and settings.

- **Standard** leaves power management to GNOME unless you enable the external
  monitor setting below.
- **Caffeine** keeps the computer and screen awake. Choose **15 minutes**,
  **30 minutes**, **1 hour**, or **No timer**. Changing the duration restarts
  the countdown; when it expires, the tile returns to Standard.

## Settings

| Setting | Effect |
| --- | --- |
| **Allow screen blanking** | Let the screen dim, lock, and blank while Caffeine prevents automatic suspend. Applies the next time Caffeine starts. |
| **Prevent sleep with an external monitor** | In Standard mode, prevent automatic suspend while an external monitor is connected. Applies immediately; the screen can still blank. |
| **Show panel icon** | Show the coffee cup while Caffeine is active. |

With screen blanking allowed, Caffeine continues through screen lock. Otherwise,
locking ends Caffeine. Suspend inhibition may also affect manual sleep,
depending on the system policy. The extension does not change lid behavior or
manage separate lid-handling services.

## Removal

```sh
gnome-extensions disable keep-awake@v9eq.github.io
gnome-extensions uninstall keep-awake@v9eq.github.io
```

[Contributing](CONTRIBUTING.md) · [GPL-2.0-or-later](LICENSE)
