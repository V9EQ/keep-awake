// SPDX-License-Identifier: GPL-2.0-or-later

import GLib from 'gi://GLib';

export function assert(condition, message) {
    if (!condition)
        throw new Error(message);
}

export function sleep(milliseconds) {
    return new Promise(resolve => {
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, milliseconds, () => {
            resolve();
            return GLib.SOURCE_REMOVE;
        });
    });
}

export async function waitFor(predicate, message) {
    const deadline = GLib.get_monotonic_time() + 7 * GLib.USEC_PER_SEC;
    while (!predicate()) {
        assert(GLib.get_monotonic_time() < deadline, `Timed out: ${message}`);
        await sleep(25);
    }
}
