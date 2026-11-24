// SPDX-License-Identifier: GPL-2.0-or-later

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const LOGIN = 'org.freedesktop.login1';
const LOGIN_PATH = '/org/freedesktop/login1';
const LOGIN_IFACE = `${LOGIN}.Manager`;
const POWER = 'org.freedesktop.UPower';
const POWER_PATH = '/org/freedesktop/UPower';
const TIMEOUT_MS = 5000;
const LID_DELAY_MS = 2000;

export const LidState = Object.freeze({OFF: 'off', STARTING: 'starting', ON: 'on', ERROR: 'error'});

export class LidSuspend {
    constructor(name, reason, onChanged, logger) {
        this._name = name;
        this._reason = reason;
        this._onChanged = onChanged;
        this._logger = logger;
        this._run = null;
        this.state = LidState.OFF;
    }

    start() {
        if (this._run)
            return;

        const run = {
            cancellable: new Gio.Cancellable(),
            handlers: [],
            fd: -1,
            timerId: 0,
            closed: false,
            preparing: false,
            pending: false,
            generation: 0,
        };
        this._run = run;
        this._setState(LidState.STARTING);
        this._initialize(run).catch(error => this._fail(run, error));
    }

    stop() {
        this._release();
        this._setState(LidState.OFF);
    }

    destroy() {
        this._onChanged = null;
        this._release();
    }

    async _initialize(run) {
        const [power, login] = await Promise.all([
            this._proxy(POWER, POWER_PATH, POWER, run),
            this._proxy(LOGIN, LOGIN_PATH, LOGIN_IFACE, run, Gio.DBusProxyFlags.DO_NOT_LOAD_PROPERTIES),
        ]);
        if (this._run !== run)
            return;

        const lid = this._readLid(power);
        if (lid === null || !login.g_name_owner)
            throw new Error('No laptop lid or logind service is available');

        run.power = power;
        run.login = login;
        for (const proxy of [power, login]) {
            const owner = proxy.g_name_owner;
            this._connect(run, proxy, 'notify::g-name-owner', () => {
                if (proxy.g_name_owner !== owner)
                    this._fail(run, new Error(`${proxy.g_name} changed owner`));
            });
        }
        this._connect(run, login, 'g-signal', (_proxy, _sender, name, parameters) => {
            if (name !== 'PrepareForSleep')
                return;
            run.preparing = parameters.get_child_value(0).get_boolean();
            run.generation++;
            this._clearTimer(run);
        });

        const [canSuspend] = (await this._call(run, 'CanSuspend', null)).deepUnpack();
        if (this._run !== run)
            return;
        if (canSuspend !== 'yes')
            throw new Error(`Suspend not available without interactive authorization (${canSuspend})`);

        const fd = await this._acquire(run);
        if (this._run !== run) {
            GLib.close(fd);
            return;
        }
        run.fd = fd;
        // Arm only for a new close event, never for a lid that is already closed.
        run.closed = this._readLid(power);
        if (run.closed === null)
            throw new Error('UPower no longer reports a laptop lid');
        this._connect(run, power, 'g-properties-changed', () => this._onLidChanged(run));
        this._setState(LidState.ON);
    }

    _onLidChanged(run) {
        const closed = this._readLid(run.power);
        if (closed === null) {
            this._fail(run, new Error('UPower no longer reports a laptop lid'));
            return;
        }
        if (closed === run.closed)
            return;

        run.closed = closed;
        const generation = ++run.generation;
        this._clearTimer(run);
        if (!closed || run.preparing || run.pending)
            return;

        run.timerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, LID_DELAY_MS, () => {
            run.timerId = 0;
            this._suspend(run, generation).catch(error => this._fail(run, error));
            return GLib.SOURCE_REMOVE;
        });
    }

    async _suspend(run, generation) {
        const stillClosed = () => this._run === run && run.generation === generation &&
            !run.preparing && this._readLid(run.power) === true;
        if (!stillClosed())
            return;

        // PreparingForSleep does not emit PropertiesChanged; read it directly.
        const login = run.login;
        const preparing = await new Promise((resolve, reject) => {
            login.g_connection.call(login.g_name_owner, LOGIN_PATH, 'org.freedesktop.DBus.Properties',
                'Get', new GLib.Variant('(ss)', [LOGIN_IFACE, 'PreparingForSleep']),
                new GLib.VariantType('(v)'), Gio.DBusCallFlags.NO_AUTO_START,
                TIMEOUT_MS, run.cancellable, (bus, result) => {
                    try {
                        resolve(bus.call_finish(result).get_child_value(0).get_variant().get_boolean());
                    } catch (error) {
                        reject(error);
                    }
                });
        });
        if (preparing || !stillClosed())
            return;

        run.pending = true;
        try {
            await this._call(run, 'Suspend', new GLib.Variant('(b)', [false]));
        } catch (error) {
            // An independent sleep request may arrive between the Get and Suspend calls.
            if (Gio.DBusError.get_remote_error(error) !== `${LOGIN}.OperationInProgress`)
                throw error;
        } finally {
            run.pending = false;
        }
    }

    _readLid(power) {
        if (power.get_cached_property('LidIsPresent')?.get_boolean() !== true)
            return null;
        return power.get_cached_property('LidIsClosed')?.get_boolean() ?? null;
    }

    _connect(run, object, signal, callback) {
        run.handlers.push([object, object.connect(signal, callback)]);
    }

    _proxy(name, path, iface, run, flags = Gio.DBusProxyFlags.GET_INVALIDATED_PROPERTIES) {
        return new Promise((resolve, reject) => {
            Gio.DBusProxy.new_for_bus(Gio.BusType.SYSTEM, flags | Gio.DBusProxyFlags.DO_NOT_AUTO_START,
                null, name, path, iface, run.cancellable, (_source, result) => {
                    try {
                        resolve(Gio.DBusProxy.new_for_bus_finish(result));
                    } catch (error) {
                        reject(error);
                    }
                });
        });
    }

    _call(run, method, parameters) {
        return new Promise((resolve, reject) => {
            run.login.call(method, parameters, Gio.DBusCallFlags.NO_AUTO_START,
                TIMEOUT_MS, run.cancellable, (proxy, result) => {
                    try {
                        resolve(proxy.call_finish(result));
                    } catch (error) {
                        reject(error);
                    }
                });
        });
    }

    _acquire(run) {
        return new Promise((resolve, reject) => {
            const parameters = new GLib.Variant('(ssss)', ['handle-lid-switch', this._name, this._reason, 'block']);
            run.login.call_with_unix_fd_list('Inhibit', parameters, Gio.DBusCallFlags.NO_AUTO_START,
                TIMEOUT_MS, null, run.cancellable, (proxy, result) => {
                    try {
                        const [reply, fdList] = proxy.call_with_unix_fd_list_finish(result);
                        const index = reply.get_child_value(0).get_handle();
                        const fds = fdList?.steal_fds() ?? [];
                        for (const [i, fd] of fds.entries()) {
                            if (i !== index)
                                GLib.close(fd);
                        }
                        if (fds[index] === undefined)
                            throw new Error('logind did not return an inhibitor descriptor');
                        resolve(fds[index]);
                    } catch (error) {
                        reject(error);
                    }
                });
        });
    }

    _clearTimer(run) {
        if (run.timerId) {
            GLib.Source.remove(run.timerId);
            run.timerId = 0;
        }
    }

    _release() {
        const run = this._run;
        if (!run)
            return;

        this._run = null;
        this._clearTimer(run);
        for (const [object, id] of run.handlers)
            object.disconnect(id);
        run.cancellable.cancel();
        if (run.fd >= 0)
            GLib.close(run.fd);
    }

    _fail(run, error) {
        if (this._run !== run)
            return;

        this._logger.warn(`Could not handle lid suspend: ${error.message}`);
        this._release();
        this._setState(LidState.ERROR);
    }

    _setState(state) {
        if (state === this.state)
            return;
        this.state = state;
        this._onChanged?.();
    }
}
