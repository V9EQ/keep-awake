// SPDX-License-Identifier: GPL-2.0-or-later

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {ExternalDisplayWatcher} from '../src/displays.js';
import {assert, waitFor} from './helpers.js';

const NAME = 'org.gnome.Mutter.DisplayConfig';
const PATH = '/org/gnome/Mutter/DisplayConfig';
const bus = Gio.DBus.session;
const updates = [];
const warnings = [];
let monitors = [];
const service = Gio.DBusExportedObject.wrapJSObject(`<node><interface name="${NAME}">
    <method name="GetCurrentState">
        <arg type="u" direction="out"/>
        <arg type="a((ssss)a(siiddada{sv})a{sv})" direction="out"/>
        <arg type="a(iiduba(ssss)a{sv})" direction="out"/>
        <arg type="a{sv}" direction="out"/>
    </method>
    <signal name="MonitorsChanged"/>
</interface></node>`, {
    GetCurrentState() {
        return [1, monitors, [], {}];
    },
});

const internal = [['eDP-1', 'Vendor', 'Panel', '0'], [], {'is-builtin': new GLib.Variant('b', true)}];
const external = [['DP-1', 'Vendor', 'Display', '1'], [], {}];
monitors = [internal];
service.export(bus, PATH);
const owner = await new Promise(resolve => {
    const id = Gio.bus_own_name_on_connection(bus, NAME, Gio.BusNameOwnerFlags.NONE, () => resolve(id), null);
});
const watcher = new ExternalDisplayWatcher(() => updates.push(watcher.connected),
    {warn: message => warnings.push(message)});

try {
    await waitFor(() => updates.length === 1, 'initial display state');
    assert(!updates[0], 'Built-in panel must not count as external');

    monitors = [internal, external];
    service.emit_signal('MonitorsChanged', null);
    await waitFor(() => updates.length === 2, 'external monitor connected');
    assert(updates[1], 'External monitor must be detected regardless of layout');

    monitors = [internal];
    service.emit_signal('MonitorsChanged', null);
    await waitFor(() => updates.length === 3, 'external monitor disconnected');
    assert(!updates[2], 'Disconnect must clear external display state');
    assert(warnings.length === 0, warnings.join('\n'));
    print('External display checks passed');
} finally {
    watcher.destroy();
    Gio.bus_unown_name(owner);
    service.unexport();
}
