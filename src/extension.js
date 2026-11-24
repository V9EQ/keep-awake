// SPDX-License-Identifier: GPL-2.0-or-later

import Gio from 'gi://Gio';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Ornament, PopupSeparatorMenuItem} from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {QuickMenuToggle, SystemIndicator} from 'resource:///org/gnome/shell/ui/quickSettings.js';

import {ExternalDisplayWatcher} from './displays.js';
import {SessionInhibitor, State} from './inhibitor.js';
import {Key} from './settings.js';
import {AwakeTimer} from './timer.js';

const Mode = Object.freeze({STANDARD: 'standard', CAFFEINE: 'caffeine'});

export default class KeepAwakeExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        const title = _('Keep Awake');
        const icon = new Gio.FileIcon({file: this.dir.resolve_relative_path('icons/keep-awake-symbolic.svg')});
        this._indicator = new SystemIndicator();
        this._panelIcon = this._indicator._addIndicator();
        this._panelIcon.gicon = icon;
        this._panelIcon.accessible_name = _('Keep Awake is active');
        this._toggle = new QuickMenuToggle({
            title,
            gicon: icon,
            toggleMode: true,
            menuButtonAccessibleName: _('Power modes and timer'),
        });
        this._indicator.quickSettingsItems.push(this._toggle);
        this._timer = new AwakeTimer(() => this._inhibitor.deactivate());
        this._duration = 0;
        this._timerItems = new Map();
        this._modeItems = new Map();
        this._addModeItems();
        this._addTimerItems();
        this._toggle.menu.addMenuItem(new PopupSeparatorMenuItem());
        this._preferencesItem = this._toggle.menu.addAction(_('Keep Awake Settings'), () => this.openPreferences());
        this._inhibitor = new SessionInhibitor(this.uuid, _('Keep the session awake'), state => {
            this._updateTimer();
            this._syncExternalInhibitor();
            this._updateToggle(state);
        }, this.getLogger());
        this._toggle.connect('clicked', () => {
            this._selectMode(this._selectedMode() === Mode.STANDARD ? Mode.CAFFEINE : Mode.STANDARD);
            this._updateToggle(this._inhibitor.state);
        });
        this._settingsId = this._settings.connect('changed', (_settings, key) => {
            if (key === Key.PREVENT_EXTERNAL_SLEEP)
                this._syncDisplayWatcher();
            else if (key === Key.SHOW_PANEL_ICON)
                this._updateToggle(this._inhibitor.state);
        });
        this._syncDisplayWatcher();
        this._modeId = Main.sessionMode.connect('updated', () => this._onSessionModeChanged());
        this._onSessionModeChanged();
        Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
    }

    disable() {
        if (this._modeId)
            Main.sessionMode.disconnect(this._modeId);
        this._modeId = 0;
        if (this._settingsId)
            this._settings.disconnect(this._settingsId);
        this._settingsId = 0;
        this._timer?.cancel();
        this._inhibitor?.destroy();
        this._displayWatcher?.destroy();
        this._externalInhibitor?.destroy();
        // Shell parents the submenu separately from the tile.
        this._toggle?.menu.destroy();
        this._toggle?.destroy();
        this._indicator?.destroy();
        this._inhibitor = null;
        this._toggle = null;
        this._panelIcon = null;
        this._indicator = null;
        this._timer = null;
        this._timerItems = null;
        this._modeItems = null;
        this._displayWatcher = null;
        this._externalInhibitor = null;
        this._preferencesItem = null;
        this._settings = null;
    }

    _onSessionModeChanged() {
        const {isLocked, allowSettings} = Main.sessionMode;
        if (isLocked) {
            this._toggle.menu.close();
            if (!this._inhibitor.allowsScreenBlanking)
                this._inhibitor.deactivate();
        }

        this._toggle.visible = !isLocked;
        this._preferencesItem.visible = !isLocked && allowSettings;
        this._updateToggle(this._inhibitor.state);
    }

    _addModeItems() {
        const menu = this._toggle.menu;
        menu.setHeader('preferences-system-symbolic', _('Power mode'));
        for (const [mode, label] of [
            [Mode.STANDARD, _('Standard')],
            [Mode.CAFFEINE, _('Caffeine')],
        ]) {
            const item = menu.addAction(label, () => this._selectMode(mode));
            this._modeItems.set(mode, item);
        }
        menu.addMenuItem(new PopupSeparatorMenuItem(_('Caffeine timer')));
    }

    _selectedMode(state = this._inhibitor.state) {
        return state === State.ON || state === State.STARTING ? Mode.CAFFEINE : Mode.STANDARD;
    }

    _selectMode(mode) {
        if (Main.sessionMode.isLocked)
            return;

        if (mode === Mode.STANDARD)
            this._inhibitor.deactivate();
        else
            this._inhibitor.activate(this._settings.get_boolean(Key.ALLOW_SCREEN_BLANKING));
    }

    _syncDisplayWatcher() {
        if (this._settings.get_boolean(Key.PREVENT_EXTERNAL_SLEEP)) {
            if (this._displayWatcher)
                return;

            const logger = this.getLogger();
            this._externalInhibitor = new SessionInhibitor(this.uuid, _('External monitor connected'),
                state => {
                    if (state === State.OFF)
                        this._syncExternalInhibitor();
                }, logger);
            this._displayWatcher = new ExternalDisplayWatcher(() => this._syncExternalInhibitor(), logger);
        } else {
            this._displayWatcher?.destroy();
            this._externalInhibitor?.destroy();
            this._displayWatcher = null;
            this._externalInhibitor = null;
        }
    }

    _syncExternalInhibitor() {
        if (this._displayWatcher?.connected && this._selectedMode() === Mode.STANDARD)
            this._externalInhibitor.activate(true);
        else
            this._externalInhibitor?.deactivate();
    }

    _addTimerItems() {
        const menu = this._toggle.menu;
        for (const [seconds, label] of [
            [0, _('No timer')],
            [15 * 60, _('15 minutes')],
            [30 * 60, _('30 minutes')],
            [60 * 60, _('1 hour')],
        ]) {
            const item = menu.addAction(label, () => this._selectDuration(seconds));
            item.setOrnament(seconds === this._duration ? Ornament.DOT : Ornament.NONE);
            this._timerItems.set(seconds, {item, label});
        }
    }

    _selectDuration(seconds) {
        if (seconds === this._duration)
            return;

        this._timerItems.get(this._duration).item.setOrnament(Ornament.NONE);
        this._duration = seconds;
        this._timerItems.get(seconds).item.setOrnament(Ornament.DOT);
        this._updateTimer();
        this._updateToggle(this._inhibitor.state);
    }

    _updateTimer() {
        if (this._inhibitor.state === State.ON)
            this._timer.restart(this._duration);
        else
            this._timer.cancel();
    }

    _updateToggle(state) {
        const mode = this._selectedMode(state);
        this._toggle.checked = state === State.ON;
        this._panelIcon.visible = state === State.ON && !Main.sessionMode.isLocked &&
            this._settings.get_boolean(Key.SHOW_PANEL_ICON);
        this._modeItems.get(Mode.CAFFEINE).setSensitive(state !== State.UNAVAILABLE);
        for (const [choice, item] of this._modeItems)
            item.setOrnament(mode === choice ? Ornament.DOT : Ornament.NONE);

        const subtitles = {
            [State.UNAVAILABLE]: _('Unavailable'),
            [State.STARTING]: _('Starting…'),
            [State.ERROR]: _('Could not start'),
        };
        const timerLabel = mode === Mode.CAFFEINE && this._duration
            ? this._timerItems.get(this._duration).label
            : null;
        this._toggle.subtitle = subtitles[state] ?? timerLabel ?? this._modeItems.get(mode).label.text;
    }
}
