// SPDX-License-Identifier: GPL-2.0-or-later

import {AwakeTimer} from '../src/timer.js';
import {assert, sleep} from './helpers.js';

let elapsed = 0;
const timer = new AwakeTimer(() => elapsed++);
try {
    timer.restart(1);
    timer.restart(1);
    await sleep(2100);
    assert(elapsed === 1, 'A rearmed timer must fire exactly once');

    timer.restart(1);
    timer.restart(0);
    await sleep(2100);
    assert(elapsed === 1, 'The no-timer preset must cancel the countdown');

    timer.restart(1);
    timer.cancel();
    await sleep(2100);
    assert(elapsed === 1, 'A cancelled timer must not fire');

    print('Awake timer checks passed');
} finally {
    timer.cancel();
}
