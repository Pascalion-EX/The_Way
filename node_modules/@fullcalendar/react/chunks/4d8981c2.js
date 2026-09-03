function joinClassNames(...args) {
    return args.filter(Boolean).join(' ');
}
/*
TODO: dedup with @full-ui/headless-grid somehow
*/
function fracToCssDim(frac) {
    return frac * 100 + '%';
}

export { fracToCssDim as f, joinClassNames as j };
