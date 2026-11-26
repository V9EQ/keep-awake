# Keep Awake

A GNOME Shell **48–51** extension for preventing automatic suspend from Quick Settings.

## Installation

From a checkout, run `make install`. This requires GNU Make, Node.js, the GLib
schema tools, and `gnome-extensions`. Log out and back in, then enable the extension:

```sh
gnome-extensions enable keep-awake@v9eq.github.io
```

## Usage

Turn on the **Keep Awake** tile to prevent idle screen blanking, locking, and
suspend. Use the arrow for settings or to choose **15 minutes**, **30 minutes**,
**1 hour**, or **No timer**. Changing the duration restarts the countdown.
Keep Awake starts off and turns off on screen lock or timer expiry.

## Settings

| Setting | Effect |
| --- | --- |
| **Suspend on lid close with an external monitor** | Request suspend if the laptop lid closes while an external display is active. Off by default. Works with the tile off and the screen locked, as long as the extension is enabled. |
| **Show panel icon** | Show the coffee cup while Keep Awake is active. |

The lid option requests suspend, not shutdown. Test with the **Keep Awake**
tile off first: system policy and sleep inhibitors still apply. The extension
cannot prevent unexpected wake-ups and does not try to suspend again on wake.

## Removal

```sh
gnome-extensions disable keep-awake@v9eq.github.io
gnome-extensions uninstall keep-awake@v9eq.github.io
```

[Contributing](CONTRIBUTING.md) · [GPL-2.0-or-later](LICENSE)
