// SPDX-License-Identifier: GPL-2.0-or-later

import Gio from 'gi://Gio';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Ornament, PopupSeparatorMenuItem} from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {QuickMenuToggle, SystemIndicator} from 'resource:///org/gnome/shell/ui/quickSettings.js';

import {SessionInhibitor, State} from './inhibitor.js';
import {LidState, LidSuspend} from './lid.js';
import {Key} from './settings.js';
import {AwakeTimer} from './timer.js';

const Mode = Object.freeze({DEFAULT: 'default', AWAKE: 'awake', LID: 'lid'});

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
            this._updateToggle(state);
        }, this.getLogger());
        this._lid = new LidSuspend(title, _('Handle suspend on lid close'),
            () => this._updateToggle(this._inhibitor.state), this.getLogger());
        this._toggle.connect('clicked', () => {
            this._selectMode(this._selectedMode() === Mode.DEFAULT ? Mode.AWAKE : Mode.DEFAULT);
            this._updateToggle(this._inhibitor.state);
        });
        this._settingsId = this._settings.connect('changed', (_settings, key) => {
            if (key === Key.SUSPEND_ON_LID_CLOSE)
                this._syncLidMode();
            else if (key === Key.SHOW_PANEL_ICON)
                this._updateToggle(this._inhibitor.state);
        });
        this._syncLidMode();
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
        this._lid?.destroy();
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
        this._lid = null;
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
            [Mode.AWAKE, _('Prevent idle sleep')],
            [Mode.DEFAULT, _('Use GNOME defaults')],
            [Mode.LID, _('Sleep on lid close')],
        ]) {
            const item = menu.addAction(label, () => this._selectMode(mode));
            this._modeItems.set(mode, item);
        }
        menu.addMenuItem(new PopupSeparatorMenuItem(_('Keep Awake timer')));
    }

    _selectedMode(state = this._inhibitor.state) {
        if (this._settings.get_boolean(Key.SUSPEND_ON_LID_CLOSE))
            return Mode.LID;
        if (state === State.ON || state === State.STARTING)
            return Mode.AWAKE;
        return Mode.DEFAULT;
    }

    _selectMode(mode) {
        if (Main.sessionMode.isLocked)
            return;

        const lidSelected = this._settings.get_boolean(Key.SUSPEND_ON_LID_CLOSE);
        if (mode === Mode.LID) {
            if (lidSelected)
                this._syncLidMode();
            else
                this._settings.set_boolean(Key.SUSPEND_ON_LID_CLOSE, true);
            return;
        }

        if (lidSelected)
            this._settings.set_boolean(Key.SUSPEND_ON_LID_CLOSE, false);
        if (mode === Mode.DEFAULT)
            this._inhibitor.deactivate();
        else if (this._selectedMode() !== Mode.AWAKE)
            this._inhibitor.toggle(this._settings.get_boolean(Key.ALLOW_SCREEN_BLANKING));
    }

    _syncLidMode() {
        if (this._settings.get_boolean(Key.SUSPEND_ON_LID_CLOSE)) {
            this._inhibitor.deactivate();
            this._lid.start();
        } else {
            this._lid.stop();
        }
        this._updateToggle(this._inhibitor.state);
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
        const lidSelected = mode === Mode.LID;
        this._toggle.checked = lidSelected ? this._lid.state === LidState.ON : state === State.ON;
        this._panelIcon.visible = state === State.ON && !Main.sessionMode.isLocked &&
            this._settings.get_boolean(Key.SHOW_PANEL_ICON);
        this._modeItems.get(Mode.AWAKE).setSensitive(state !== State.UNAVAILABLE);
        for (const [choice, item] of this._modeItems)
            item.setOrnament(mode === choice ? Ornament.DOT : Ornament.NONE);
        for (const {item} of this._timerItems.values())
            item.setSensitive(!lidSelected);
        if (lidSelected) {
            this._toggle.subtitle = {
                [LidState.STARTING]: _('Starting lid mode…'),
                [LidState.ON]: this._modeItems.get(mode).label.text,
                [LidState.ERROR]: _('Lid suspend unavailable'),
            }[this._lid.state] ?? null;
            return;
        }

        const subtitles = {
            [State.UNAVAILABLE]: _('Unavailable'),
            [State.STARTING]: _('Starting…'),
            [State.ERROR]: _('Could not start'),
        };
        const timerLabel = mode === Mode.AWAKE && this._duration
            ? this._timerItems.get(this._duration).label
            : null;
        this._toggle.subtitle = subtitles[state] ?? timerLabel ?? this._modeItems.get(mode).label.text;
    }
}
