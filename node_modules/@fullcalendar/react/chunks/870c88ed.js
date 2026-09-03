function getAppendableRoot(el) {
    const root = el.getRootNode();
    if (root instanceof Document) {
        return root.body || root.documentElement; // pick body if available
    }
    return root;
}
function computeElIsRtl(el) {
    return getComputedStyle(el).direction === 'rtl';
}
// Style
// ----------------------------------------------------------------------------------------------------------------
const PIXEL_PROP_RE = /(top|left|right|bottom|width|height)$/i;
function applyStyle(el, props) {
    for (let propName in props) {
        applyStyleProp(el, propName, props[propName]);
    }
}
function applyStyleProp(el, name, val) {
    if (val == null) {
        el.style[name] = '';
    }
    else if (typeof val === 'number' && PIXEL_PROP_RE.test(name)) {
        el.style[name] = `${val}px`;
    }
    else {
        el.style[name] = val;
    }
}
// Event Handling
// ----------------------------------------------------------------------------------------------------------------
// if intercepting bubbled events at the document/window/body level,
// and want to see originating element (the 'target'), use this util instead
// of `ev.target` because it goes within web-component boundaries.
function getEventTargetViaRoot(ev) {
    return ev.composedPath?.()[0] ?? ev.target;
}

export { applyStyle as a, getEventTargetViaRoot as b, computeElIsRtl as c, applyStyleProp as d, getAppendableRoot as g };
