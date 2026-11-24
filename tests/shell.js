// SPDX-License-Identifier: GPL-2.0-or-later

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {QuickMenuToggle} from 'resource:///org/gnome/shell/ui/quickSettings.js';

import {assert, waitFor} from './helpers.js';

const UUID = 'keep-awake@v9eq.github.io';
const NAME = 'org.gnome.SessionManager';

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
        const settings = extension.getSettings();
        const indicator = extension._indicator;
        const icon = extension._panelIcon;
        const overlay = tile.menu.actor.get_parent();
        const menuCount = overlay.get_n_children();
        assert(indicators.contains(icon), 'Icon is not in the Quick Settings indicators');
        assert(tile.toggleMode && !tile.checked && !icon.visible, 'Wrong default UI state');
        assert(tile.gicon.equal(icon.gicon) && icon.gicon.get_file().query_exists(null), 'Missing shared SVG');
        await waitFor(() => extension._inhibitor.state === 'off', 'session manager ready');
        const labels = tile.menu._getMenuItems().map(item => item.label?.text).filter(Boolean);
        assert(labels.join(',') === 'No timer,15 minutes,30 minutes,1 hour,Keep Awake Settings',
            'The submenu should only contain timer presets and settings');
        assert(tile.subtitle === null, 'There should be no default mode label');
        assert(!extension._lidSuspend, 'Docked lid suspend must be off by default');
        settings.set_boolean('suspend-on-docked-lid-close', true);
        await waitFor(() => extension._lidSuspend, 'Enable the lid watcher while the tile is off');
        const lidWatcher = extension._lidSuspend;
        extension._timerItems.get(900).item.activate(null);
        tile.emit('clicked', 1);
        await waitFor(() => tile.checked && icon.visible && requests.length === 1, 'activation');
        assert(tile.subtitle === '15 minutes', 'Timer preset was not selected');
        assert(requests[0].flags === 8, 'Default activation must inhibit idle only');
        settings.set_boolean('show-panel-icon', false);
        await waitFor(() => !icon.visible, 'hide the active icon immediately');
        assert(tile.checked && !requests[0].closed, 'Hiding the icon must not stop Keep Awake');
        settings.set_boolean('show-panel-icon', true);
        await waitFor(() => icon.visible, 'restore the active icon immediately');
        tile.emit('clicked', 1);
        await waitFor(() => !tile.checked && !icon.visible && requests[0].closed, 'toggle off');

        tile.emit('clicked', 1);
        await waitFor(() => tile.checked && requests.length === 2, 'second activation');
        Main.sessionMode.pushMode('unlock-dialog');
        await waitFor(() => !tile.checked && !tile.visible && !icon.visible && requests[1].closed,
            'default policy stops on lock');
        assert(extension._lidSuspend === lidWatcher, 'Lock must leave the lid watcher running');
        Main.sessionMode.popMode('unlock-dialog');
        assert(tile.visible && !tile.checked, 'Default policy must not reactivate after unlock');

        settings.set_boolean('allow-screen-blanking', true);
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
        menu.open();
        tile.menu.open();
        assert(tile.menu.isOpen, 'Could not open the timer submenu');
        assert(Main.extensionManager.disableExtension(UUID), 'Could not disable extension');
        await waitFor(() => !findTile() && requests[3].closed && !indicators.get_children().includes(indicator),
            'disable cleanup');
        assert(overlay.get_n_children() === menuCount - 1, 'Disabling must remove the submenu actor');
        assert(!tile.menu.isOpen, 'Disabling must close the timer submenu');
        assert(!extension._lidSuspend && lidWatcher._cancellable.is_cancelled(), 'Disable must stop watching the lid');
        menu.close();
        settings.set_boolean('show-panel-icon', false);
        assert(Main.extensionManager.enableExtension(UUID), 'Could not re-enable extension');
        await waitFor(() => findTile()?.reactive, 'tile recreation');
        assert(!findTile().checked && requests.length === 4, 'Mode did not reset');
        const newWatcher = extension._lidSuspend;
        assert(newWatcher && newWatcher !== lidWatcher, 'Lid preference did not survive re-enable');
        settings.set_boolean('suspend-on-docked-lid-close', false);
        await waitFor(() => !extension._lidSuspend && newWatcher._cancellable.is_cancelled(), 'Lid watcher cleanup');
        findTile().emit('clicked', 1);
        await waitFor(() => findTile().checked && requests.length === 5, 'activation with saved preference');
        assert(!extension._panelIcon.visible, 'Panel icon preference did not survive re-enable');
        findTile().emit('clicked', 1);
        await waitFor(() => requests[4].closed, 'cleanup after final activation');

        for (let i = 0; i < 10; i++) {
            assert(Main.extensionManager.disableExtension(UUID), 'Could not disable extension');
            await waitFor(() => !findTile(), 'tile removal');
            assert(overlay.get_n_children() === menuCount - 1, 'Submenu retained after disable');
            assert(Main.extensionManager.enableExtension(UUID), 'Could not re-enable extension');
            await waitFor(() => findTile()?.reactive, 'tile recreation after repeated enable');
            assert(overlay.get_n_children() === menuCount, 'Submenus accumulated after re-enable');
        }
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
