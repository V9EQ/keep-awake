# Contributing

Read the [architecture notes](docs/architecture.md) before changing Shell
integration or power policy.

- Use ES modules, four-space indentation, single quotes, and semicolons.
- Acquire resources in `enable()` and release them in synchronous `disable()`.
  Keep D-Bus calls asynchronous and avoid polling.
- Use focused [Conventional Commits](https://www.conventionalcommits.org/).
- Put usage instructions in the README and implementation notes in `docs/`.

## Validation

```sh
make test        # GJS, dbus-run-session, timeout
make test-shell  # gnome-shell-test-tool (GNOME 50+)
unzip -t dist/keep-awake@v9eq.github.io.shell-extension.zip
git diff --check
```

The D-Bus and Shell checks use private buses and do not suspend the machine.
For a live check, use `gnome-session-inhibit --list` to verify that toggling
Keep Awake off or disabling the extension releases its request.
