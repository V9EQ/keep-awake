UUID := keep-awake@v9eq.github.io
STAGE := $(CURDIR)/.build/extension
BUNDLE := dist/$(UUID).shell-extension.zip

.PHONY: all check test pack install clean

all: pack

check:
	@set -e; for file in src/*.js tests/*.js; do node --input-type=module --check < "$$file"; done
	node -e 'if (require("./src/metadata.json").uuid !== "$(UUID)") process.exit(1)'

test: check
	GIO_USE_VFS=local timeout 20s dbus-run-session -- gjs -m tests/sessionInhibitor.js

pack: check
	rm -rf "$(STAGE)"
	mkdir -p "$(STAGE)" dist
	cp src/*.js src/metadata.json LICENSE "$(STAGE)/"
	gnome-extensions pack --force --out-dir=dist \
		--extra-source=sessionInhibitor.js --extra-source=LICENSE "$(STAGE)"

install: pack
	gnome-extensions install --force "$(BUNDLE)"
	@echo 'Log out and back in, then run: gnome-extensions enable $(UUID)'

clean:
	rm -rf dist .build
