# Architecture

## Quick Settings

`src/extension.js` creates a native `QuickMenuToggle` and adds it through
`Main.panel.statusArea.quickSettings.addExternalIndicator()`. The tile and
`SystemIndicator` share a bundled symbolic coffee cup. Shell places the status
icon with its other Quick Settings indicators. It is visible only when an
inhibitor is active.

The tile submenu shows the timer presets. `src/awakeTimer.js` owns one GLib
one-shot source, armed after successful activation and removed when Keep Awake
turns off or the extension is disabled. It measures time while the system is
awake. Presets are kept for as long as the extension is enabled.

The extension uses the default `user` session mode. Shell disables it when the
session locks. It recreates the tile in the off state after unlocking.

## Idle inhibition

`src/sessionInhibitor.js` calls `org.gnome.SessionManager.Inhibit` on the user
session bus. The `IDLE` flag (`8`) keeps GNOME Session from reporting the session
as idle. GNOME Shell's screen shield therefore does not start its idle fade or
lock. The GNOME Settings Daemon power plugin checks the same flag and cancels its
idle dimming and sleep timers while the session is unlocked. There is no need to
request `SUSPEND` (`4`), which can also inhibit sleep requested independently of
inactivity. This does not cover external power policies.

Each activation owns a private bus connection. GNOME Session drops the inhibitor
when its sender disconnects, so turning the tile off or disabling the extension
can release it without waiting for a cookie. Even a request that timed out after
reaching the server is released. `disable()` synchronously detaches the UI and
cancels pending work; connection closure completes asynchronously. Late replies
cannot change a newer tile. If the session manager loses its bus name, the tile
returns to unavailable and does not reactivate automatically.

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
registration, toggle on/off, and disable/re-enable. GNOME 48–50 were reviewed
against upstream sources, not run in live sessions. The headless check does not
verify physical display blanking or suspend.

Additional references: [Quick Settings guide][quick-settings],
[extension review guidelines][review], and [GNOME Session Manager D-Bus API][dbus].

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
[review]: https://gjs.guide/extensions/review-guidelines/review-guidelines.html
[dbus]: https://gnome.pages.gitlab.gnome.org/gnome-session/re04.html
