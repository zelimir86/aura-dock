// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Extension = imports.ui.extension;

const Me = Extension.getCurrentExtension();

let metadata = null;
let controller = null;

function init(meta) {
    metadata = meta;
}

function enable() {
    const { DockController } = Me.imports.dock;

    controller = new DockController(metadata || Me.meta);
    controller.enable();
}

function disable() {
    if (!controller)
        return;

    controller.destroy();
    controller = null;
}
