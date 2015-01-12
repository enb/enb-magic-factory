var path = require('path'),
    fixTarget = require('./utils').fixTarget;

/**
 * Используется для регистрации созданных на файловой системе нод и таргетов.
 *
 * Если не передать список ожидаемых целей, или передать пустой список, то это будет означать,
 * что пользователь хочет собирать все регистрируемые ноды и таргеты.
 *
 * @name MagicConfig
 * @param {String[]} [requiredTargets] Цели, которые хочет собрать пользователь.
 * @constructor
 */
function MagicConfig(requiredTargets) {
    this._requiredTargets = requiredTargets ? requiredTargets.map(function (target) {
        return fixTarget(target);
    }) : [];
    this._nodes = {};
    this._targets = {};
}

/**
 * Возвращает список ожидаемых пользователем целей.
 *
 * @returns {String[]}
 */
MagicConfig.prototype.getRequiredTargets = function () {
    return this._requiredTargets;
};

/**
 * Проверяет была ли явно или косвенно зарегистрирована нода.
 * Нода посчитается косвенно зарегистрированной, если у неё имеются зарегистрированные таргеты.
 *
 * @param {String} node
 * @returns {Boolean}
 */
MagicConfig.prototype.hasNode = function (node) {
    var nodesFromTargets = {};

    Object.keys(this._targets).forEach(function (target) {
        nodesFromTargets[path.dirname(target)] = true;
    });

    return !!(this._nodes[node] || nodesFromTargets[node]);
};

/**
 * Проверяет была ли явно заригистрирована нода.
 *
 * @param {String} node
 * @returns {Boolean}
 */
MagicConfig.prototype.isRegisteredNode = function (node) {
    return !!this._nodes[node];
};

/**
 * Возвращает список всех явно или косвенно зарегистрированных нод.
 * Помимо явно зарегистрированных будут включены те ноды, у которых есть зарегистрированные таргеты.
 *
 * @returns {String[]}
 */
MagicConfig.prototype.getNodes = function () {
    var nodesFromTargets = {};

    Object.keys(this._targets).forEach(function (target) {
        nodesFromTargets[path.dirname(target)] = true;
    });

    return [].concat(Object.keys(this._nodes), Object.keys(nodesFromTargets));
};

/**
 * Возвращает список явно зарегистрированных нод.
 *
 * @returns {String[]}
 */
MagicConfig.prototype.getRegisteredNodes = function () {
    return Object.keys(this._nodes);
};

/**
 * Регистрирует ноды.
 * Будут зарегистрированы только те ноды, которые состоят в списке ожидаемых пользователем целей.
 *
 * @param {String[]} nodes
 */
MagicConfig.prototype.registerNodes = function (nodes) {
    var _this = this;

    nodes.forEach(function (node) {
        _this.registerNode(node);
    });
};

/**
 * Регистрирует ноду.
 * Нода будет зарегистрирована только если она состоит в списке ожидаемых пользователем целей.
 *
 * @param {String} node
 */
MagicConfig.prototype.registerNode = function (node) {
    node = fixTarget(node);

    if (this.isRequiredNode(node)) {
        this._nodes[node] = true;
    }
};

/**
 * Проверяет был ли явно заригистрирован таргет.
 *
 * @param {String} target
 * @returns {Boolean}
 */
MagicConfig.prototype.isRegisteredTarget = function (target) {
    return !!this._targets[target];
};

/**
 * Возвращает список явно зарегистрированных таргетов.
 *
 * @returns {String[]}
 */
MagicConfig.prototype.getRegisteredTargets = function () {
    return Object.keys(this._targets);
};

/**
 * Регистрирует таргеты.
 * Будут зарегистрированы только те таргеты, которые состоят в списке ожидаемых пользователем целей.
 *
 * @param {String[]} targets
 */
MagicConfig.prototype.registerTargets = function (targets) {
    var _this = this;

    targets.forEach(function (target) {
        _this.registerTarget(target);
    });
};

/**
 * Регистрирует таргет.
 * Таргет будет зарегистрирован только если он состоит в списке ожидаемых пользователем целей.
 *
 * @param {String} target
 */
MagicConfig.prototype.registerTarget = function (target) {
    target = fixTarget(target);

    if (this.isRequiredTarget(target)) {
        this._targets[target] = true;
    }
};

/**
 * Проверяет, входит ли нода в список ожидаемых пользователем целей.
 *
 * @param {String} node
 * @returns {Boolean}
 */
MagicConfig.prototype.isRequiredNode = function (node) {
    return this._isRequiredTarget(node, function (required, study, splitR, splitS) {
        // Если проверяемая нода входит в ожидаемую цель
        return (splitR.length < splitS.length && (required === splitS.splice(0, splitR.length).join(path.sep)) ||
            // Если ожидаемая цель является частью проверяемой ноды
            (splitR.length > splitS.length && (node === splitR.splice(0, splitS.length).join(path.sep)))
        );
    });
};

/**
 * Проверяет, входит ли таргет в список ожидаемых пользователем целей.
 *
 * @param {String} target
 * @returns {Boolean}
 */
MagicConfig.prototype.isRequiredTarget = function (target) {
    return this._isRequiredTarget(target, function (required, study, splitR, splitS) {
        // Если проверяемый таргет входит в ожидаемую цель
        return (splitR.length < splitS.length && (required === splitS.splice(0, splitR.length).join(path.sep)));
    });
};

MagicConfig.prototype._isRequiredTarget = function (target, f) {
    target = fixTarget(target);

    var basename = path.basename(target),
        requiredTargets = this._requiredTargets,
        need = false;

    // Игнорируем скрытые файлы
    if (basename.charAt(0) === '.') {
        return false;
    }

    // Если пользователь явно не указал желаемые цели,
    // считаем, что он хочет собирать все регистрируемые цели
    if (!requiredTargets || requiredTargets.length === 0) {
        return true;
    }

    requiredTargets.forEach(function (requiredTarget) {
        var splitedTarget = target.split(path.sep),
            splitedRequiredTarget = requiredTarget.split(path.sep);

        if (
            // Если проверяемая цель и ожидаемая равны
            (splitedRequiredTarget.length === splitedTarget.length && target === requiredTarget) ||
            // Специальное условие
            f(requiredTarget, target, splitedRequiredTarget, splitedTarget)
        ) {
            need = true;
        }
    });

    return need;
};

module.exports = MagicConfig;
