// SPDX-License-Identifier: GPL-2.0-or-later

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const SESSION_MANAGER = 'org.gnome.SessionManager';
const SESSION_PATH = '/org/gnome/SessionManager';
// GNOME stops its inactivity timers for IDLE; SUSPEND would also affect manual sleep.
const INHIBIT_IDLE = 1 << 3;
const DBUS_TIMEOUT_MS = 5000;

export const State = Object.freeze({
    UNAVAILABLE: 'unavailable',
    OFF: 'off',
    STARTING: 'starting',
    ON: 'on',
    ERROR: 'error',
});

export class SessionInhibitor {
    constructor(appId, reason, onStateChanged, logger) {
        this._appId = appId;
        this._reason = reason;
        this._onStateChanged = onStateChanged;
        this._logger = logger;
        this._request = null;
        this._owner = null;
        this._state = State.UNAVAILABLE;
        this._watchId = Gio.bus_watch_name(Gio.BusType.SESSION, SESSION_MANAGER,
            Gio.BusNameWatcherFlags.NONE,
            (_connection, _name, owner) => this._setOwner(owner),
            () => this._setOwner(null));
    }

    get state() {
        return this._state;
    }

    toggle() {
        switch (this._state) {
        case State.OFF:
        case State.ERROR:
            this._start();
            break;
        case State.ON:
            this._stop();
            this._setState(State.OFF);
            break;
        }
    }

    destroy() {
        Gio.bus_unwatch_name(this._watchId);
        this._onStateChanged = null;
        this._stop();
    }

    _setOwner(owner) {
        if (!this._onStateChanged || owner === this._owner)
            return;

        this._stop();
        this._owner = owner;
        this._setState(owner ? State.OFF : State.UNAVAILABLE);
    }

    _setState(state) {
        this._state = state;
        this._onStateChanged(state);
    }

    _start() {
        const request = {
            cancellable: new Gio.Cancellable(),
            connection: null,
            closedId: 0,
        };
        this._request = request;
        this._setState(State.STARTING);

        try {
            const address = GLib.getenv('DBUS_SESSION_BUS_ADDRESS');
            if (!address)
                throw new Error('Missing GNOME session bus address');

            // The inhibitor belongs to this private bus client, not to Shell.
            Gio.DBusConnection.new_for_address(address,
                Gio.DBusConnectionFlags.AUTHENTICATION_CLIENT |
                Gio.DBusConnectionFlags.MESSAGE_BUS_CONNECTION,
                null, request.cancellable,
                (_source, result) => {
                    try {
                        const connection = Gio.DBusConnection.new_for_address_finish(result);
                        if (this._request !== request) {
                            connection.close(null, null);
                            return;
                        }
                        this._inhibit(request, connection);
                    } catch (error) {
                        this._fail(request, error);
                    }
                });
        } catch (error) {
            this._fail(request, error);
        }
    }

    _inhibit(request, connection) {
        request.connection = connection;
        request.closedId = connection.connect('closed', (_connection, _vanished, error) =>
            this._fail(request, error ?? new Error('Inhibitor connection closed')));
        connection.call(this._owner, SESSION_PATH, SESSION_MANAGER, 'Inhibit',
            new GLib.Variant('(susu)', [this._appId, 0, this._reason, INHIBIT_IDLE]),
            new GLib.VariantType('(u)'), Gio.DBusCallFlags.NO_AUTO_START,
            DBUS_TIMEOUT_MS, request.cancellable, (source, result) => {
                try {
                    source.call_finish(result);
                    if (this._request === request)
                        this._setState(State.ON);
                } catch (error) {
                    this._fail(request, error);
                }
            });
    }

    _fail(request, error) {
        if (this._request !== request)
            return;

        this._logger.warn(`Could not inhibit the session: ${error.message}`);
        this._stop();
        this._setState(State.ERROR);
    }

    _stop() {
        const request = this._request;
        if (!request)
            return;

        this._request = null;
        request.cancellable.cancel();
        if (request.connection) {
            request.connection.disconnect(request.closedId);
            // Disconnect releases the inhibitor even if its cookie never arrived.
            request.connection.close(null, null);
        }
    }
}
