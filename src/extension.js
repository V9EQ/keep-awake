// SPDX-License-Identifier: GPL-2.0-or-later

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {QuickToggle, SystemIndicator} from 'resource:///org/gnome/shell/ui/quickSettings.js';

import {SessionInhibitor, State} from './sessionInhibitor.js';

export default class KeepAwakeExtension extends Extension {
    enable() {
        const title = _('Keep Awake');
        this._indicator = new SystemIndicator();
        this._toggle = new QuickToggle({
            title,
            accessibleName: title,
            iconName: 'video-display-symbolic',
            toggleMode: true,
        });
        this._indicator.quickSettingsItems.push(this._toggle);
        this._inhibitor = new SessionInhibitor(this.uuid, _('Keep the session awake'),
            state => this._updateToggle(state), this.getLogger());
        this._toggle.connect('clicked', () => {
            this._inhibitor.toggle();
            this._updateToggle(this._inhibitor.state);
        });
        this._updateToggle(this._inhibitor.state);
        Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
    }

    disable() {
        this._inhibitor?.destroy();
        this._toggle?.destroy();
        this._indicator?.destroy();
        this._inhibitor = null;
        this._toggle = null;
        this._indicator = null;
    }

    _updateToggle(state) {
        this._toggle.checked = state === State.ON;
        this._toggle.reactive = state !== State.UNAVAILABLE && state !== State.STARTING;
        const subtitles = {
            [State.UNAVAILABLE]: _('Unavailable'),
            [State.STARTING]: _('Starting…'),
            [State.ERROR]: _('Could not start'),
        };
        this._toggle.subtitle = subtitles[state] ?? null;
    }
}
