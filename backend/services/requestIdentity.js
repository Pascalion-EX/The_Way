// Only server authentication can populate this cache. It lives for one request;
// bans, role changes, and token revocation are rechecked on the next request.
const identities = new WeakMap();
export const setRequestIdentity = (req, user) => identities.set(req, user);
export const getRequestIdentity = (req) => identities.get(req);
