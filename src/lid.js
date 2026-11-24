// SPDX-License-Identifier: GPL-2.0-or-later

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const LOGIN = 'org.freedesktop.login1';
const DISPLAY = 'org.gnome.Mutter.DisplayConfig';
const SESSION = 'org.gnome.SessionManager';
const DBUS_TIMEOUT_MS = 5000;

function openProxy(bus, name, path, iface, cancellable) {
    return new Promise((resolve, reject) => {
        Gio.DBusProxy.new_for_bus(bus, Gio.DBusProxyFlags.DO_NOT_AUTO_START, null,
            name, path, iface, cancellable, (_source, result) => {
                try {
                    resolve(Gio.DBusProxy.new_for_bus_finish(result));
                } catch (error) {
                    reject(error);
                }
            });
    });
}

function readBoolean(proxy, property) {
    return proxy.get_cached_property(property)?.get_boolean();
}

export class LidSuspend {
    constructor(logger) {
        this._logger = logger;
        this._cancellable = new Gio.Cancellable();
        this._signals = [];
        this._lidOwner = null;
        this._suspendPending = false;
        this._start().catch(error => this._warn('Could not watch the lid switch', error));
    }

    destroy() {
        this._cancellable.cancel();
        for (const id of this._signals)
            this._login.disconnect(id);
        this._signals = [];
        this._login = this._display = this._session = null;
    }

    async _start() {
        const [login, display, session] = await Promise.all([
            openProxy(Gio.BusType.SYSTEM, LOGIN, '/org/freedesktop/login1',
                `${LOGIN}.Manager`, this._cancellable),
            openProxy(Gio.BusType.SESSION, DISPLAY, '/org/gnome/Mutter/DisplayConfig',
                DISPLAY, this._cancellable),
            openProxy(Gio.BusType.SESSION, SESSION, '/org/gnome/SessionManager',
                SESSION, this._cancellable),
        ]);
        if (this._cancellable.is_cancelled())
            return;

        this._login = login;
        this._display = display;
        this._session = session;
        this._signals = [
            login.connect('notify::g-name-owner', () => this._syncLid()),
            login.connect('g-properties-changed', () => this._syncLid()),
            login.connect('g-signal', (_proxy, sender, name, parameters) => {
                if (sender === this._lidOwner && name === 'PrepareForSleep')
                    [this._preparingForSleep] = parameters.deepUnpack();
            }),
        ];
        this._syncLid();
    }

    _syncLid() {
        const owner = this._login.get_name_owner();
        const closed = owner ? readBoolean(this._login, 'LidClosed') : undefined;
        const justClosed = owner && owner === this._lidOwner && this._lidClosed === false && closed === true;
        if (owner !== this._lidOwner)
            this._preparingForSleep = readBoolean(this._login, 'PreparingForSleep');
        this._lidOwner = owner;
        this._lidClosed = closed;

        // A cached closed state (startup, reconnect, resume) must not request sleep.
        if (!justClosed || this._preparingForSleep || this._suspendPending ||
            !readBoolean(this._session, 'SessionIsActive') ||
            !readBoolean(this._display, 'HasExternalMonitor'))
            return;

        // gsd-power inhibits logind's lid handling, not this explicit sleep request.
        this._suspendPending = true;
        this._login.call('Suspend', new GLib.Variant('(b)', [false]), Gio.DBusCallFlags.NONE,
            DBUS_TIMEOUT_MS, this._cancellable, (source, result) => {
                this._suspendPending = false;
                try {
                    source.call_finish(result);
                } catch (error) {
                    this._warn('Could not suspend on lid close', error);
                }
            });
    }

    _warn(message, error) {
        if (!this._cancellable.is_cancelled())
            this._logger.warn(`${message}: ${error.message}`);
    }
}
