# Keep Awake

A GNOME Shell **48–51** extension for preventing automatic suspend from Quick Settings.

## Installation

From a checkout, run `make install`. This requires GNU Make, Node.js, the GLib
schema tools, and `gnome-extensions`. Log out and back in, then enable the extension:

```sh
gnome-extensions enable keep-awake@v9eq.github.io
```

## Usage

Click the **Keep Awake** tile to toggle idle sleep prevention. Use the arrow
for settings or to choose **15 minutes**, **30 minutes**, **1 hour**, or
**No timer**. Changing the duration while active restarts the countdown. When
the timer expires, Keep Awake turns off.

## Settings

| Setting | Effect |
| --- | --- |
| **Allow screen blanking** | Let the screen dim, lock, and blank while Keep Awake prevents automatic suspend. Applies the next time Keep Awake starts. |
| **Suspend on lid close with an external monitor** | Request suspend if the laptop lid closes while an external display is active. Off by default. Works with the tile off and the screen locked, as long as the extension is enabled. |
| **Show panel icon** | Show the coffee cup while Keep Awake is active. |

With screen blanking allowed, Keep Awake continues through screen lock.
Otherwise, locking turns it off. Suspend inhibition may also affect manual
sleep, depending on system policy.

The lid option requests suspend, not shutdown. Test with the **Keep Awake**
tile off first: system policy and sleep inhibitors still apply. The extension
cannot prevent unexpected wake-ups and does not try to suspend again on wake.

## Removal

```sh
gnome-extensions disable keep-awake@v9eq.github.io
gnome-extensions uninstall keep-awake@v9eq.github.io
```

[Contributing](CONTRIBUTING.md) · [GPL-2.0-or-later](LICENSE)
