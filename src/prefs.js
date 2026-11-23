// SPDX-License-Identifier: GPL-2.0-or-later

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class KeepAwakePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const _ = this.gettext.bind(this);
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage({title: _('General')});
        const power = new Adw.PreferencesGroup({title: _('Power')});
        const row = new Adw.SwitchRow({
            title: _('Allow screen blanking'),
            subtitle: _('The screen follows GNOME’s idle settings. Applies the next time Keep Awake is turned on.'),
        });
        settings.bind('allow-screen-blanking', row, 'active', Gio.SettingsBindFlags.DEFAULT);
        power.add(row);
        page.add(power);

        const appearance = new Adw.PreferencesGroup({title: _('Appearance')});
        const panelIcon = new Adw.SwitchRow({
            title: _('Show panel icon'),
            subtitle: _('Show a cup in the top panel while Keep Awake is active.'),
        });
        settings.bind('show-panel-icon', panelIcon, 'active', Gio.SettingsBindFlags.DEFAULT);
        appearance.add(panelIcon);
        page.add(appearance);
        window.add(page);
    }
}
