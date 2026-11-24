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

The automated checks run with private buses and do not suspend the machine.
For changes to display handling, also test on hardware: compare
`gnome-session-inhibit --list` before and after hotplug, and verify cleanup on
extension disable. Check real suspend separately after saving your work.
