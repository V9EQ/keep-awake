// SPDX-License-Identifier: GPL-2.0-or-later

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {LidState, LidSuspend} from '../src/lidSuspend.js';

const LOGIN = 'org.freedesktop.login1';
const LOGIN_IFACE = `${LOGIN}.Manager`;
const POWER = 'org.freedesktop.UPower';
const bus = Gio.DBus.system;
const [fd, file] = GLib.file_open_tmp('keep-awake-lid-test-XXXXXX');
let closed = true;
let preparing = false;
let denied = false;
let requests = 0;
const warnings = [];

function assert(condition, message) {
    if (!condition)
        throw new Error(message);
}

function sleep(ms) {
    return new Promise(resolve => GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
        resolve();
        return GLib.SOURCE_REMOVE;
    }));
}

async function waitFor(condition, message) {
    for (let i = 0; i < 160; i++) {
        if (condition())
            return;
        await sleep(25);
    }
    throw new Error(message);
}

function descriptorCount() {
    const dir = Gio.File.new_for_path('/proc/self/fd').enumerate_children(
        'standard::symlink-target', Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null);
    let count = 0;
    for (let info; (info = dir.next_file(null)); )
        count += Number(info.get_symlink_target() === file);
    dir.close(null);
    return count;
}

const power = Gio.DBusExportedObject.wrapJSObject(`<node><interface name="${POWER}">
    <property name="LidIsPresent" type="b" access="read"/>
    <property name="LidIsClosed" type="b" access="read"/>
</interface></node>`, {
    get LidIsPresent() {
        return true;
    },
    get LidIsClosed() {
        return closed;
    },
});
const login = Gio.DBusExportedObject.wrapJSObject(`<node><interface name="${LOGIN_IFACE}">
    <property name="PreparingForSleep" type="b" access="read"/>
    <signal name="PrepareForSleep"><arg type="b"/></signal>
    <method name="CanSuspend"><arg type="s" direction="out"/></method>
    <method name="Inhibit">
        <arg type="s" direction="in"/><arg type="s" direction="in"/>
        <arg type="s" direction="in"/><arg type="s" direction="in"/>
        <arg type="h" direction="out"/>
    </method>
    <method name="Suspend"><arg type="b" direction="in"/></method>
</interface></node>`, {
    get PreparingForSleep() {
        return preparing;
    },
    CanSuspend() {
        return 'yes';
    },
    InhibitAsync([what, who, why, mode], invocation) {
        assert(what === 'handle-lid-switch' && who === 'Test' && why === 'Test lid' && mode === 'block',
            'Unexpected logind inhibitor');
        const list = Gio.UnixFDList.new();
        const index = list.append(fd);
        invocation.return_value_with_unix_fd_list(new GLib.Variant('(h)', [index]), list);
        bus.flush_sync(null);
        for (const duplicate of list.steal_fds())
            GLib.close(duplicate);
    },
    SuspendAsync([interactive], invocation) {
        assert(!interactive, 'Suspend must not ask for interactive authorization');
        requests++;
        if (denied)
            invocation.return_dbus_error('org.freedesktop.DBus.Error.AccessDenied', 'Sleep is inhibited');
        else
            invocation.return_value(null);
    },
});

function setLid(value) {
    closed = value;
    power.emit_property_changed('LidIsClosed', new GLib.Variant('b', value));
    power.flush();
}

const controller = new LidSuspend('Test', 'Test lid', () => {}, {warn: message => warnings.push(message)});
power.export(bus, '/org/freedesktop/UPower');
login.export(bus, '/org/freedesktop/login1');
const names = await Promise.all([POWER, LOGIN].map(name => new Promise(resolve => {
    const id = Gio.bus_own_name_on_connection(bus, name, Gio.BusNameOwnerFlags.NONE, () => resolve(id), null);
})));
try {
    controller.start();
    await waitFor(() => controller.state === LidState.ON || controller.state === LidState.ERROR, 'Lid mode did not start');
    assert(controller.state === LidState.ON, warnings.join('\n'));
    assert(descriptorCount() === 2, 'Expected one owned inhibitor descriptor');
    await sleep(2200);
    assert(requests === 0, 'Starting with the lid closed must not suspend');

    setLid(false);
    await sleep(100);
    setLid(true);
    await sleep(100);
    setLid(false);
    await sleep(2100);
    assert(requests === 0, 'Opening the lid must cancel debounce');

    preparing = true;
    setLid(true);
    await sleep(2200);
    assert(requests === 0, 'An existing sleep transition must not be duplicated');
    preparing = false;
    setLid(false);
    await sleep(100);
    setLid(true);
    await waitFor(() => requests === 1, 'Closing the lid must request one suspend');
    login.emit_signal('PrepareForSleep', new GLib.Variant('(b)', [true]));
    login.emit_signal('PrepareForSleep', new GLib.Variant('(b)', [false]));
    await sleep(100);
    assert(requests === 1, 'Resume must not retrigger suspend for a closed lid');

    denied = true;
    setLid(false);
    await sleep(100);
    setLid(true);
    await waitFor(() => controller.state === LidState.ERROR, 'Suspend rejection must release custom lid policy');
    assert(requests === 2 && warnings.length === 1, 'Expected one failed suspend request');
    assert(descriptorCount() === 1, 'Failed policy retained its inhibitor descriptor');
    controller.start();
    await waitFor(() => controller.state === LidState.ON, 'Lid mode could not be rearmed');
    controller.stop();
    assert(descriptorCount() === 1, 'Stopping retained the inhibitor descriptor');
    print('Lid suspend integration checks passed (no real suspend)');
} finally {
    controller.destroy();
    for (const id of names)
        Gio.bus_unown_name(id);
    power.unexport();
    login.unexport();
    GLib.close(fd);
    GLib.unlink(file);
}
