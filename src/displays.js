// SPDX-License-Identifier: GPL-2.0-or-later

import Gio from 'gi://Gio';

const SERVICE = 'org.gnome.Mutter.DisplayConfig';
const PATH = '/org/gnome/Mutter/DisplayConfig';
const TIMEOUT_MS = 5000;

export class ExternalDisplayWatcher {
    constructor(onChanged, logger) {
        this._onChanged = onChanged;
        this._logger = logger;
        this._bus = Gio.DBus.session;
        this.connected = false;
        this._request = null;
        this._signalId = this._bus.signal_subscribe(SERVICE, SERVICE, 'MonitorsChanged', PATH,
            null, Gio.DBusSignalFlags.NONE, () => this._refresh());
        this._refresh();
    }

    destroy() {
        this._bus.signal_unsubscribe(this._signalId);
        this._request?.cancel();
        this._request = null;
        this._onChanged = null;
    }

    _refresh() {
        if (!this._onChanged)
            return;

        this._request?.cancel();
        const request = new Gio.Cancellable();
        this._request = request;
        this._bus.call(SERVICE, PATH, SERVICE, 'GetCurrentState', null, null,
            Gio.DBusCallFlags.NO_AUTO_START, TIMEOUT_MS, request, (bus, result) => {
                let connected = false;
                try {
                    const monitors = bus.call_finish(result).get_child_value(1).deepUnpack();
                    connected = monitors.some(([, , properties]) =>
                        properties['is-builtin']?.get_boolean() !== true);
                } catch (error) {
                    if (this._request === request)
                        this._logger.warn(`Could not check external displays: ${error.message}`);
                }
                if (this._request !== request)
                    return;

                this._request = null;
                this.connected = connected;
                this._onChanged();
            });
    }
}
