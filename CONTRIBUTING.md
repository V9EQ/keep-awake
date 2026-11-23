# Contributing

Use GNOME Shell 48–51. Read [Architecture](docs/architecture.md) and check the
upstream Shell and session APIs before changing the tile or inhibitor.

## Conventions

- Use ES modules, four-space indentation, single quotes, and semicolons.
- Create runtime resources in `enable()` and release them in a synchronous
  `disable()`. Keep D-Bus operations asynchronous; do not poll the desktop or
  change system settings to simulate inhibition.
- Keep documentation in concise English with sentence-case headings. Describe
  current behavior and distinguish source review from runtime verification.
- Use focused Conventional Commits such as `feat: add a quick settings toggle`
  or `docs: clarify supported GNOME versions`.

## Validation

```sh
make test
make pack
unzip -t dist/keep-awake@v9eq.github.io.shell-extension.zip
git diff --check
```

`make check` checks JavaScript syntax and the bundle UUID. `make test` additionally
requires GJS, `dbus-run-session`, and `timeout`. It uses a stand-in session manager
on a private bus to check activation, rejection, timeout, cleanup, and service
loss. A separate check covers one-shot timer expiry and cancellation. Neither
changes desktop settings.

For a live check, use a test session with screen blanking and automatic suspend
already configured. With the tile on, wait past both timeouts. With it off,
verify normal behavior resumes and the cup icon disappears. Use
`gnome-session-inhibit --list` to identify
this extension's request without relying on the global inhibited state, which
other applications can affect. While active, disable the extension or manually
lock the session; verify the request disappears and the tile returns off after
re-enabling or unlocking. Verify that changing timer presets rearms or cancels
the countdown, expiry releases the inhibitor, and manual suspend still works.
