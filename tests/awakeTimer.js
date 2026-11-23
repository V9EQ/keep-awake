// SPDX-License-Identifier: GPL-2.0-or-later

import GLib from 'gi://GLib';

import {AwakeTimer} from '../src/awakeTimer.js';

function wait(milliseconds) {
    return new Promise(resolve => {
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, milliseconds, () => {
            resolve();
            return GLib.SOURCE_REMOVE;
        });
    });
}

let elapsed = 0;
const timer = new AwakeTimer(() => elapsed++);
try {
    timer.restart(1);
    timer.restart(1);
    await wait(2100);
    if (elapsed !== 1)
        throw new Error('A rearmed timer must fire exactly once');

    timer.restart(1);
    timer.restart(0);
    await wait(2100);
    if (elapsed !== 1)
        throw new Error('The no-timer preset must cancel the countdown');

    timer.restart(1);
    timer.cancel();
    await wait(2100);
    if (elapsed !== 1)
        throw new Error('A cancelled timer must not fire');

    print('Awake timer checks passed');
} finally {
    timer.cancel();
}
