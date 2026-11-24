// SPDX-License-Identifier: GPL-2.0-or-later

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {Key} from './settings.js';

export default class KeepAwakePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const _ = this.gettext.bind(this);
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage({title: _('General')});
        const power = new Adw.PreferencesGroup({title: _('Power')});
        const row = new Adw.SwitchRow({
            title: _('Allow screen blanking'),
            subtitle: _('Applies next time Keep Awake turns on.'),
        });
        settings.bind(Key.ALLOW_SCREEN_BLANKING, row, 'active', Gio.SettingsBindFlags.DEFAULT);
        power.add(row);

        const lid = new Adw.SwitchRow({
            title: _('Suspend on lid close with an external monitor'),
            subtitle: _('Applies even when the Keep Awake tile is off. Does not prevent wake-ups.'),
        });
        settings.bind(Key.SUSPEND_ON_DOCKED_LID_CLOSE, lid, 'active', Gio.SettingsBindFlags.DEFAULT);
        power.add(lid);
        page.add(power);

        const appearance = new Adw.PreferencesGroup({title: _('Appearance')});
        const panelIcon = new Adw.SwitchRow({
            title: _('Show panel icon'),
        });
        settings.bind(Key.SHOW_PANEL_ICON, panelIcon, 'active', Gio.SettingsBindFlags.DEFAULT);
        appearance.add(panelIcon);
        page.add(appearance);
        window.add(page);
    }
}
