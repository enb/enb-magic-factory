var path = require('path'),
    lastSlash = new RegExp('\\' + path.sep + '$'),
    pointSlash = new RegExp('^(\\.\\' + path.sep + ')+');
/**
 * @example
 * ./path/to/target/ --> path/to/target
 * @param {String} target
 * returns {String}
 */
function fixTarget(target) {
    return target.replace(lastSlash, '').replace(pointSlash, '');
}

module.exports = {
    fixTarget: fixTarget
};
