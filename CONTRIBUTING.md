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

`make check` checks JavaScript syntax, the bundle UUID, and the schema.
`make test` also requires GJS, `dbus-run-session`, and `timeout`. It uses a stand-in session manager
on a private bus to check activation, rejection, timeout, cleanup, and service
loss. Separate checks cover one-shot timer expiry and lid handling with a stand-in
UPower and logind. These checks do not change desktop settings or suspend the
machine. `make test-shell` adds a headless UI smoke test using
`gnome-shell-test-tool` (GNOME 50+), temporary settings, and a private bus.

For a live check, use a test session with screen blanking and automatic suspend
already configured. With the tile on, wait past both timeouts. With it off,
verify normal behavior resumes and the cup icon disappears. Use
`gnome-session-inhibit --list` to identify this extension's request without
relying on the global inhibited state, which other applications can affect.
Disabling the extension must always release its
request. With **Allow screen blanking** off, locking must also release it. With
it on, verify the screen blanks normally and the inhibitor persists through
locking until the timer expires or you turn the mode off after unlocking.
Verify that changing timer presets rearms or cancels the countdown and that
changing **Show panel icon** takes effect without releasing the inhibitor.

For a hardware lid check, stop other lid handlers first. With an external display
connected, verify **Use GNOME defaults** leaves the display usable on lid close and
**Sleep on lid close** sleeps after two seconds, including while locked.
Open the lid before the delay to check cancellation. Save work before testing;
isolated D-Bus tests cannot verify hardware suspend or resume.
