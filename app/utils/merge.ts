export function merge(target: any, source: any) {
  Object.keys(source).forEach(function (key) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      return;
    }
    if (
      Object.prototype.hasOwnProperty.call(source, key) &&
      source[key] &&
      typeof source[key] === "object"
    ) {
      merge((target[key] = target[key] || {}), source[key]);
      return;
    }
    target[key] = source[key];
  });
}
