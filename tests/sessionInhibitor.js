// SPDX-License-Identifier: GPL-2.0-or-later

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {SessionInhibitor, State} from '../src/sessionInhibitor.js';

const NAME = 'org.gnome.SessionManager';
const APP = 'keep-awake@test';
const REASON = 'Test idle inhibition';
const bus = Gio.DBus.session;
const xml = `<node><interface name="${NAME}">
    <method name="Inhibit">
        <arg type="s" direction="in"/><arg type="u" direction="in"/>
        <arg type="s" direction="in"/><arg type="u" direction="in"/>
        <arg type="u" direction="out"/>
    </method>
</interface></node>`;

const requests = [];
const warnings = [];
let ownerId = 0;
let controller = null;
const service = Gio.DBusExportedObject.wrapJSObject(xml, {
    InhibitAsync(parameters, invocation) {
        const sender = invocation.get_sender();
        const request = {parameters, invocation, connected: true};
        requests.push(request);
        request.watchId = Gio.bus_watch_name_on_connection(bus, sender,
            Gio.BusNameWatcherFlags.NONE, null, () => {
                request.connected = false;
                Gio.bus_unwatch_name(request.watchId);
                request.watchId = 0;
            });
    },
});

function assert(condition, message) {
    if (!condition)
        throw new Error(message);
}

async function waitFor(predicate, message) {
    const deadline = GLib.get_monotonic_time() + 7 * GLib.USEC_PER_SEC;
    while (!predicate()) {
        assert(GLib.get_monotonic_time() < deadline, message);
        await new Promise(resolve => {
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 10, () => {
                resolve();
                return GLib.SOURCE_REMOVE;
            });
        });
    }
}

function waitForState(state) {
    return waitFor(() => controller.state === state, `Expected state: ${state}`);
}

function createController() {
    return new SessionInhibitor(APP, REASON, () => {}, {warn: message => warnings.push(message)});
}

function ownName() {
    return Gio.bus_own_name_on_connection(bus, NAME, Gio.BusNameOwnerFlags.NONE, null, null);
}

async function startRequest(index, allowScreenBlanking = false) {
    controller.toggle(allowScreenBlanking);
    assert(controller.state === State.STARTING, 'Expected pending state on activation');
    controller.toggle(); // A duplicate click must not start a second request.
    await waitFor(() => requests.length === index + 1, `Missing request ${index + 1}`);
    const request = requests[index];
    const flags = allowScreenBlanking ? 4 : 8;
    assert(JSON.stringify(request.parameters) === JSON.stringify([APP, 0, REASON, flags]),
        'Wrong Inhibit arguments');
    assert(controller.allowsScreenBlanking === allowScreenBlanking, 'Wrong active inhibition policy');
    assert(request.invocation.get_sender() !== bus.get_unique_name(), 'Expected a private client');
    return request;
}

function accept(request) {
    request.invocation.return_value(new GLib.Variant('(u)', [1]));
}

try {
    service.export(bus, '/org/gnome/SessionManager');
    controller = createController();
    assert(controller.state === State.UNAVAILABLE, 'Expected unavailable without a service');
    ownerId = ownName();
    await waitForState(State.OFF);

    const first = await startRequest(0);
    accept(first);
    await waitForState(State.ON);
    controller.toggle();
    await waitForState(State.OFF);
    await waitFor(() => !first.connected, 'Toggle off did not disconnect its client');

    const rejected = await startRequest(1);
    rejected.invocation.return_dbus_error(`${NAME}.TestError`, 'Inhibition refused');
    await waitForState(State.ERROR);
    await waitFor(() => !rejected.connected, 'Rejected client did not disconnect');

    const timedOut = await startRequest(2);
    await waitForState(State.ERROR);
    await waitFor(() => !timedOut.connected, 'Timed-out client did not disconnect');
    accept(timedOut); // A late reply must not affect a later attempt.
    assert(warnings.length === 2, 'Expected a warning for each failed request');

    const pending = await startRequest(3);
    controller.destroy();
    controller = createController();
    await waitFor(() => !pending.connected, 'Destroy did not release the pending client');
    accept(pending);
    await waitForState(State.OFF);

    const active = await startRequest(4);
    accept(active);
    await waitForState(State.ON);
    Gio.bus_unown_name(ownerId);
    ownerId = 0;
    await waitForState(State.UNAVAILABLE);
    await waitFor(() => !active.connected, 'Service loss did not release the active client');
    ownerId = ownName();
    await waitForState(State.OFF);
    assert(requests.length === 5, 'Keep Awake unexpectedly reactivated');

    const blanking = await startRequest(5, true);
    controller.deactivate();
    await waitForState(State.OFF);
    assert(!controller.allowsScreenBlanking, 'Deactivated request retained its policy');
    await waitFor(() => !blanking.connected, 'Deactivation did not release the pending client');
    accept(blanking);
    print('Session inhibitor integration checks passed');
} finally {
    controller?.destroy();
    if (ownerId)
        Gio.bus_unown_name(ownerId);
    for (const request of requests) {
        if (request.watchId)
            Gio.bus_unwatch_name(request.watchId);
    }
    service.unexport();
}
