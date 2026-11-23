// SPDX-License-Identifier: GPL-2.0-or-later

import GLib from 'gi://GLib';

export class AwakeTimer {
    constructor(onElapsed) {
        this._onElapsed = onElapsed;
        this._sourceId = 0;
    }

    restart(seconds) {
        this.cancel();
        if (seconds === 0)
            return;

        this._sourceId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, seconds, () => {
            this._sourceId = 0;
            this._onElapsed();
            return GLib.SOURCE_REMOVE;
        });
    }

    cancel() {
        if (!this._sourceId)
            return;

        GLib.Source.remove(this._sourceId);
        this._sourceId = 0;
    }
}
