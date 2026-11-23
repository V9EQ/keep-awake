// SPDX-License-Identifier: GPL-2.0-or-later

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {QuickMenuToggle} from 'resource:///org/gnome/shell/ui/quickSettings.js';
import {sleep} from 'resource:///org/gnome/shell/ui/scripting.js';

const UUID = 'keep-awake@v9eq.github.io';
const NAME = 'org.gnome.SessionManager';

function assert(condition, message) {
    if (!condition)
        throw new Error(message);
}

async function waitFor(predicate, description) {
    for (let i = 0; i < 100; i++) {
        if (predicate())
            return;
        await sleep(50);
    }
    throw new Error(`Timed out: ${description}`);
}

export async function run() {
    const xml = `<node><interface name="${NAME}"><method name="Inhibit">
        <arg type="s" direction="in"/><arg type="u" direction="in"/>
        <arg type="s" direction="in"/><arg type="u" direction="in"/>
        <arg type="u" direction="out"/></method></interface></node>`;
    const requests = [];
    const service = Gio.DBusExportedObject.wrapJSObject(xml, {
        InhibitAsync([app, xid, reason, flags], invocation) {
            assert(app === UUID && xid === 0 && reason, 'Wrong Inhibit payload');
            const request = {flags, closed: false};
            requests.push(request);
            request.watchId = Gio.bus_watch_name_on_connection(Gio.DBus.session, invocation.get_sender(),
                Gio.BusNameWatcherFlags.NONE, null, () => {
                    request.closed = true;
                    Gio.bus_unwatch_name(request.watchId);
                    request.watchId = 0;
                });
            invocation.return_value(new GLib.Variant('(u)', [requests.length]));
        },
    });
    service.export(Gio.DBus.session, '/org/gnome/SessionManager');
    const owner = Gio.bus_own_name_on_connection(Gio.DBus.session, NAME,
        Gio.BusNameOwnerFlags.NONE, null, null);

    try {
        const {menu, _indicators: indicators} = Main.panel.statusArea.quickSettings;
        const findTile = () => menu._grid.get_children()
            .find(item => item instanceof QuickMenuToggle && item.title === 'Keep Awake');
        await waitFor(() => findTile()?.reactive, 'interactive Keep Awake tile');
        const tile = findTile();
        const extension = Main.extensionManager.lookup(UUID).stateObj;
        const indicator = extension._indicator;
        const icon = extension._panelIcon;
        assert(indicators.contains(icon), 'Icon is not in the Quick Settings indicators');
        assert(tile.toggleMode && !tile.checked && !icon.visible, 'Wrong default UI state');
        assert(tile.gicon.equal(icon.gicon) && icon.gicon.get_file().query_exists(null), 'Missing shared SVG');
        const entries = tile.menu._getMenuItems();
        assert(entries.slice(0, 4).map(item => item.label.text).join(',') === 'No timer,15 minutes,30 minutes,1 hour',
            'Missing timer presets');
        entries[1].activate(null);
        assert(tile.subtitle === '15 minutes', 'Timer preset was not selected');
        tile.emit('clicked', 1);
        await waitFor(() => tile.checked && icon.visible && requests.length === 1, 'activation');
        assert(requests[0].flags === 8, 'Default activation must inhibit idle only');
        tile.emit('clicked', 1);
        await waitFor(() => !tile.checked && !icon.visible && requests[0].closed, 'toggle off');

        tile.emit('clicked', 1);
        await waitFor(() => tile.checked && requests.length === 2, 'second activation');
        Main.sessionMode.pushMode('unlock-dialog');
        await waitFor(() => !tile.checked && !tile.visible && !icon.visible && requests[1].closed,
            'default policy stops on lock');
        Main.sessionMode.popMode('unlock-dialog');
        assert(tile.visible && !tile.checked, 'Default policy must not reactivate after unlock');

        extension.getSettings().set_boolean('allow-screen-blanking', true);
        tile.emit('clicked', 1);
        await waitFor(() => tile.checked && icon.visible && requests.length === 3, 'suspend-only activation');
        assert(requests[2].flags === 4, 'Allow blanking must inhibit suspend only');
        Main.sessionMode.pushMode('unlock-dialog');
        assert(tile.checked && !tile.visible && !icon.visible && !requests[2].closed, 'Suspend-only lock policy failed');
        extension._timer.restart(1);
        await waitFor(() => !tile.checked && requests[2].closed, 'timer expiry while locked');
        Main.sessionMode.popMode('unlock-dialog');
        assert(tile.visible && !tile.checked, 'Expired timer must not reactivate after unlock');

        tile.emit('clicked', 1);
        await waitFor(() => tile.checked && requests.length === 4, 'activation before disabling');
        assert(Main.extensionManager.disableExtension(UUID), 'Could not disable extension');
        await waitFor(() => !findTile() && requests[3].closed && !indicators.get_children().includes(indicator),
            'disable cleanup');
        assert(Main.extensionManager.enableExtension(UUID), 'Could not re-enable extension');
        await waitFor(() => findTile()?.reactive, 'tile recreation');
        assert(!findTile().checked && requests.length === 4, 'Mode did not reset');
        print('Keep Awake Quick Settings smoke check passed');
    } finally {
        if (Main.sessionMode.isLocked)
            Main.sessionMode.popMode('unlock-dialog');
        Gio.bus_unown_name(owner);
        for (const request of requests) {
            if (request.watchId)
                Gio.bus_unwatch_name(request.watchId);
        }
        service.unexport();
    }
}
