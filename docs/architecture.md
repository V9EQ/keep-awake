# Architecture

## Quick Settings

`src/extension.js` creates a native `QuickMenuToggle` and adds it through
`Main.panel.statusArea.quickSettings.addExternalIndicator()`. The tile and
`SystemIndicator` share a bundled symbolic coffee cup. Shell places the status
icon with its other Quick Settings indicators. It is visible only when an
inhibitor is active, the session is unlocked, and `show-panel-icon` is enabled.
The visibility setting does not affect inhibition or timers.

`src/timer.js` owns one GLib one-shot source, armed only after Keep Awake acquires
its inhibitor. The preset is not persisted. Locking releases the inhibitor and
hides the tile and icon; the optional lid watcher can keep running.

## Session inhibition

`src/inhibitor.js` calls `org.gnome.SessionManager.Inhibit` with `IDLE` (`8`)
on the user session bus. This suppresses Shell's idle fade and lock and the
GNOME power plugin's inactivity-based dimming and suspend. It does not block
manual locking or override external power policies.

Each activation owns a private bus connection. GNOME Session drops the inhibitor
when its sender disconnects, so turning the tile off or disabling the extension
can release it without waiting for a cookie. Even a request that timed out after
reaching the server is released. `disable()` synchronously detaches the UI and
cancels pending work; connection closure completes asynchronously. Late replies
cannot change a newer tile. If the session manager loses its bus name, the tile
returns to unavailable without reactivating automatically.

## Lid close with an external display

In GNOME 48–51, `gsd-power` takes a low-level `handle-lid-switch` inhibitor
when an external display is active and briefly during display changes. It does
not read the old `lid-close-suspend-with-external-monitor` key, and [logind.conf]
settings cannot override the inhibitor.

`src/lid.js` sends one non-interactive [login1] `Suspend(false)` request on an
open-to-closed `LidClosed` transition if [Mutter DisplayConfig][display-config]
reports an active external monitor and GNOME Session is active. It does not
remove the inhibitor, modify system policy, or retry after wake. The watcher
continues in `unlock-dialog` and stops when the preference or extension is disabled.

## GNOME 48–51 review

The same code path applies to all four releases. The table links to the tagged
Shell, Session, and Settings Daemon sources and the version-specific porting
guides reviewed for the extension.

| GNOME | Porting guide | Shell | Session | Power plugin |
| --- | --- | --- | --- | --- |
| 48 | [48][guide48] | [48.0][shell48] | [48.0][session48] | [48.0][power48] |
| 49 | [49][guide49] | [49.0][shell49] | [49.0][session49] | [49.0][power49] |
| 50 | [50][guide50] | [50.0][shell50] | [50.0][session50] | [50.0][power50] |
| 51 | [51][guide51] | [51.0][shell51] | [51.0][session51] | [51.0][power51] |

- **48:** `QuickMenuToggle` provides its own style and menu; no custom CSS is
  needed. The second `Inhibit` argument is still documented as
  an X11 window ID; zero means no window.
- **49:** The built-in quick toggles changed, but the external registration API
  did not. The second `Inhibit` argument is now ignored without a signature change.
- **50:** The extension uses no X11-only APIs and does not depend on Shell's
  parental-control or time-limit behavior.
- **51:** Shell now rejects asynchronous `disable()`. The extension's teardown
  remains synchronous and does not depend on removed St widget properties.

GNOME Shell **51.1** was smoke-tested headless with a stand-in session manager:
toggle activation, timer expiry, preferences, and teardown. GNOME 48–50 were reviewed against
upstream sources, not run in live sessions. Headless tests do not verify
physical blanking or suspend.

Additional references: [Quick Settings guide][quick-settings],
[session modes][modes], [extension review guidelines][review], and
[GNOME Session Manager D-Bus API][dbus].

[guide48]: https://gjs.guide/extensions/upgrading/gnome-shell-48.html
[guide49]: https://gjs.guide/extensions/upgrading/gnome-shell-49.html
[guide50]: https://gjs.guide/extensions/upgrading/gnome-shell-50.html
[guide51]: https://gjs.guide/extensions/upgrading/gnome-shell-51.html
[shell48]: https://gitlab.gnome.org/GNOME/gnome-shell/-/tree/48.0/js/ui
[shell49]: https://gitlab.gnome.org/GNOME/gnome-shell/-/tree/49.0/js/ui
[shell50]: https://gitlab.gnome.org/GNOME/gnome-shell/-/tree/50.0/js/ui
[shell51]: https://gitlab.gnome.org/GNOME/gnome-shell/-/tree/51.0/js/ui
[session48]: https://gitlab.gnome.org/GNOME/gnome-session/-/tree/48.0/gnome-session
[session49]: https://gitlab.gnome.org/GNOME/gnome-session/-/tree/49.0/gnome-session
[session50]: https://gitlab.gnome.org/GNOME/gnome-session/-/tree/50.0/gnome-session
[session51]: https://gitlab.gnome.org/GNOME/gnome-session/-/tree/51.0/gnome-session
[power48]: https://gitlab.gnome.org/GNOME/gnome-settings-daemon/-/blob/48.0/plugins/power/gsd-power-manager.c
[power49]: https://gitlab.gnome.org/GNOME/gnome-settings-daemon/-/blob/49.0/plugins/power/gsd-power-manager.c
[power50]: https://gitlab.gnome.org/GNOME/gnome-settings-daemon/-/blob/50.0/plugins/power/gsd-power-manager.c
[power51]: https://gitlab.gnome.org/GNOME/gnome-settings-daemon/-/blob/51.0/plugins/power/gsd-power-manager.c
[quick-settings]: https://gjs.guide/extensions/topics/quick-settings.html
[modes]: https://gjs.guide/extensions/topics/session-modes.html
[review]: https://gjs.guide/extensions/review-guidelines/review-guidelines.html
[dbus]: https://gnome.pages.gitlab.gnome.org/gnome-session/re04.html
[display-config]: https://gitlab.gnome.org/GNOME/mutter/-/blob/51.0/data/dbus-interfaces/org.gnome.Mutter.DisplayConfig.xml
[login1]: https://www.freedesktop.org/software/systemd/man/latest/org.freedesktop.login1.html
[logind.conf]: https://www.freedesktop.org/software/systemd/man/latest/logind.conf.html
