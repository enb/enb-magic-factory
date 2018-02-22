var path = require('path'),
    lastSlash = new RegExp('\\' + path.sep + '$'),
    pointSlash = new RegExp('^(\\.\\' + path.sep + ')+'),
    wildcardChars = ['*', '{', '(', '?'];

/**
 * @example
 * ./path/to/target/ --> path/to/target
 * @param {String} target
 * returns {String}
 */
function fixTarget(target) {
    return target.replace(lastSlash, '').replace(pointSlash, '');
}

/**
 * @example
 * ./*.blocks --> true
 * ./common.blocks --> false
 * @param {String} str
 * @returns {Boolean}
 */
function looksLikeWildcard(str) {
    return wildcardChars.some(function (char) {
        return str.indexOf(char) !== -1;
    });
}

module.exports = {
    fixTarget: fixTarget,
    looksLikeWildcard: looksLikeWildcard
};
