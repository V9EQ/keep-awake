// SPDX-License-Identifier: GPL-2.0-or-later

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {LidSuspend} from '../src/lid.js';
import {assert, waitFor} from './helpers.js';

const LOGIN = 'org.freedesktop.login1';
const DISPLAY = 'org.gnome.Mutter.DisplayConfig';
const SESSION = 'org.gnome.SessionManager';
const address = GLib.getenv('DBUS_SESSION_BUS_ADDRESS');
assert(address && GLib.getenv('DBUS_SYSTEM_BUS_ADDRESS') === address, 'Run on an isolated bus via make test');
const bus = Gio.DBus.session;
const requests = [];
const warnings = [];
const logger = {warn: message => warnings.push(message)};
const ids = [];
const services = [];
let controller;

function exportService(path, iface, members, impl) {
    const xml = `<node><interface name="${iface}">${members}</interface></node>`;
    const object = Gio.DBusExportedObject.wrapJSObject(xml, impl);
    object.export(bus, path);
    services.push(object);
    return object;
}

function own(name) {
    const id = Gio.bus_own_name_on_connection(bus, name, Gio.BusNameOwnerFlags.NONE, null, null);
    ids.push(id);
}

const boolProperty = name => `<property name="${name}" type="b" access="read"/>`;
const loginState = {
    LidClosed: true,
    PreparingForSleep: false,
    SuspendAsync(parameters, invocation) {
        requests.push({parameters, invocation});
    },
};
const displayState = {HasExternalMonitor: true};
const sessionState = {SessionIsActive: true};
const login = exportService('/org/freedesktop/login1', `${LOGIN}.Manager`,
    `${boolProperty('LidClosed')}${boolProperty('PreparingForSleep')}
    <method name="Suspend"><arg type="b" direction="in"/></method>
    <signal name="PrepareForSleep"><arg type="b"/></signal>`, loginState);
const display = exportService('/org/gnome/Mutter/DisplayConfig', DISPLAY,
    boolProperty('HasExternalMonitor'), displayState);
const session = exportService('/org/gnome/SessionManager', SESSION,
    boolProperty('SessionIsActive'), sessionState);

async function setBoolean(service, state, proxy, key, value) {
    state[key] = value;
    service.emit_property_changed(key, new GLib.Variant('b', value));
    service.flush();
    await waitFor(() => proxy.get_cached_property(key)?.get_boolean() === value, `Expected ${key}=${value}`);
}

const setLid = value => setBoolean(login, loginState, controller._login, 'LidClosed', value);
const setMonitor = value => setBoolean(display, displayState, controller._display, 'HasExternalMonitor', value);
const setActive = value => setBoolean(session, sessionState, controller._session, 'SessionIsActive', value);

async function prepare(value) {
    loginState.PreparingForSleep = value;
    login.emit_signal('PrepareForSleep', new GLib.Variant('(b)', [value]));
    await waitFor(() => controller._preparingForSleep === value, 'PrepareForSleep not observed');
}

try {
    own(LOGIN);
    own(DISPLAY);
    own(SESSION);
    controller = new LidSuspend(logger);
    await waitFor(() => controller._lidClosed === true, 'Initial closed lid sampled');
    assert(!controller._suspendPending, 'Enabling with the lid closed must not suspend');

    await setLid(false);
    await setMonitor(false);
    await setLid(true);
    assert(!controller._suspendPending, 'Undocked lid close must be left to logind');
    await setMonitor(true);
    assert(!controller._suspendPending, 'Plugging a monitor in with the lid closed must not suspend');

    await setLid(false);
    await setActive(false);
    await setLid(true);
    assert(!controller._suspendPending, 'Inactive sessions must not request suspend');
    await setActive(true);
    assert(!controller._suspendPending, 'Returning to a session with the lid closed must not suspend');

    await setLid(false);
    await setLid(true);
    await waitFor(() => requests.length === 1, 'Docked lid close must request suspend');
    assert(requests[0].parameters[0] === false, 'Automatic suspend must not ask for authentication');
    await prepare(true);
    requests[0].invocation.return_value(null);
    await waitFor(() => !controller._suspendPending, 'Finish first request');
    await setLid(false);
    await setLid(true);
    assert(!controller._suspendPending, 'Must not send another request while logind is preparing sleep');
    await prepare(false);
    assert(!controller._suspendPending, 'Wake with the lid closed must not trigger another request');

    await setLid(false);
    await setLid(true);
    await waitFor(() => requests.length === 2, 'New close must re-arm suspend');
    requests[1].invocation.return_dbus_error(`${LOGIN}.TestError`, 'Suspend refused');
    await waitFor(() => warnings.length === 1, 'D-Bus refusal must be logged');
    assert(!controller._suspendPending, 'Failed request must not retry automatically');

    await setLid(false);
    await setLid(true);
    await waitFor(() => requests.length === 3, 'New close after refusal');
    controller.destroy();
    requests[2].invocation.return_dbus_error(`${LOGIN}.TestError`, 'Late reply');
    loginState.LidClosed = false;
    login.emit_property_changed('LidClosed', new GLib.Variant('b', false));
    login.flush();
    controller = new LidSuspend(logger);
    await waitFor(() => controller._lidClosed === false, 'Fresh controller ready');
    await setLid(true);
    await waitFor(() => requests.length >= 4, 'Fresh controller requests suspend');
    requests[3].invocation.return_value(null);
    await waitFor(() => !controller._suspendPending, 'Finish final request');
    assert(requests.length === 4 && warnings.length === 1, 'Destroyed controller reacted to a lid event or reply');
    print('Docked lid suspend integration checks passed');
} finally {
    controller?.destroy();
    for (const id of ids)
        Gio.bus_unown_name(id);
    for (const service of services)
        service.unexport();
}
