UUID := keep-awake@v9eq.github.io
SCHEMA := org.gnome.shell.extensions.keep-awake.gschema.xml
STAGE := $(CURDIR)/.build/extension
BUNDLE := dist/$(UUID).shell-extension.zip

.PHONY: all check test test-shell pack install clean

all: pack

check:
	@set -e; for file in src/*.js tests/*.js; do node --input-type=module --check < "$$file"; done
	node -e 'if (require("./src/metadata.json").uuid !== "$(UUID)") process.exit(1)'
	glib-compile-schemas --strict --dry-run schemas

test: check
	GIO_USE_VFS=local timeout 20s dbus-run-session -- gjs -m tests/sessionInhibitor.js
	timeout 15s gjs -m tests/awakeTimer.js
	GIO_USE_VFS=local timeout 25s dbus-run-session -- sh -c 'DBUS_SYSTEM_BUS_ADDRESS="$$DBUS_SESSION_BUS_ADDRESS" exec gjs -m tests/lidSuspend.js'

test-shell: pack
	sh tests/run-shell-smoke.sh "$(abspath $(BUNDLE))" "$(CURDIR)/tests/shellSmoke.js"

pack: check
	rm -rf "$(STAGE)"
	mkdir -p "$(STAGE)/schemas" dist
	cp src/*.js src/metadata.json LICENSE "$(STAGE)/"
	cp -R icons "$(STAGE)/"
	cp "schemas/$(SCHEMA)" "$(STAGE)/schemas/"
	gnome-extensions pack --force --out-dir=dist --schema="schemas/$(SCHEMA)" \
		--extra-source=awakeTimer.js --extra-source=lidSuspend.js --extra-source=sessionInhibitor.js \
		--extra-source=icons --extra-source=LICENSE "$(STAGE)"

install: pack
	gnome-extensions install --force "$(BUNDLE)"
	@echo 'Log out and back in, then run: gnome-extensions enable $(UUID)'

clean:
	rm -rf dist .build
