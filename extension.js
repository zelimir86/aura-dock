// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Extension = imports.ui.extension;
const Main = imports.ui.main;
const GLib = imports.gi.GLib;

const Me = Extension.getCurrentExtension();

let metadata = null;
let controllers = [];
let _monitorsChangedId = 0;

function _readMonitorMode() {
    try {
        const Gio = imports.gi.Gio;
        const path = GLib.build_filenamev([
            GLib.get_user_config_dir(), 'cinnamon', 'spices',
            Me.metadata.uuid, Me.metadata.uuid + '.json'
        ]);
        const file = Gio.File.new_for_path(path);
        const [ok, bytes] = file.load_contents(null);
        if (ok) {
            const text = imports.byteArray.toString(bytes);
            const data = JSON.parse(text);
            if (data && data.monitor && data.monitor.value)
                return data.monitor.value;
        }
    } catch (e) {
        // Fall back to the primary monitor.
    }
    return 'primary';
}

function _monitorIndicesForMode(mode) {
    const lm = Main.layoutManager;
    const primary = (lm && typeof lm.primaryIndex === 'number') ? lm.primaryIndex : 0;
    const count = lm && lm.monitors ? lm.monitors.length : 1;

    if (mode === 'primary')
        return [primary];
    if (mode === 'secondary') {
        for (let i = 0; i < count; i++) {
            if (i !== primary)
                return [i];
        }
        return [primary];
    }
    if (mode === 'all') {
        const out = [];
        for (let i = 0; i < count; i++)
            out.push(i);
        return out.length ? out : [primary];
    }
    return [primary];
}

function _destroyAll() {
    for (const c of controllers) {
        try { c.destroy(); } catch (e) { /* ignore */ }
    }
    controllers = [];
    if (global.auraDock) delete global.auraDock;
}

function _createAll(mode) {
    const { DockController } = Me.imports.dock;
    if (!mode)
        mode = _readMonitorMode();
    const indices = _monitorIndicesForMode(mode);
    for (const idx of indices) {
        const c = new DockController(idx, metadata || Me.meta);
        c.enable();
        controllers.push(c);
    }
    global.auraDock = controllers.length ? controllers[0] : null;
}

let _recreateScheduled = false;

function _scheduleRecreate() {
    if (_recreateScheduled)
        return;
    _recreateScheduled = true;
    GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
        _recreateScheduled = false;
        try {
            _destroyAll();
            _createAll();
        } catch (e) {
            global.logError(e, 'Aura Dock: recreate failed');
        }
        return GLib.SOURCE_REMOVE;
    });
}

function init(meta) {
    metadata = meta;
}

function enable() {
    _createAll();
    global.auraDockManager = { recreate: (mode) => { _destroyAll(); _createAll(mode); } };

    if (Main.layoutManager) {
        _monitorsChangedId = Main.layoutManager.connect('monitors-changed', () => {
            _scheduleRecreate();
        });
    }
}

function disable() {
    if (_monitorsChangedId && Main.layoutManager) {
        try { Main.layoutManager.disconnect(_monitorsChangedId); } catch (e) { /* ignore */ }
        _monitorsChangedId = 0;
    }
    _destroyAll();
    if (global.auraDockManager) delete global.auraDockManager;
}
