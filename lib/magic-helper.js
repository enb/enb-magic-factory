var path = require('path'),
    vow = require('vow'),
    parseArgs = require('minimist'),
    EventEmitter = require('events').EventEmitter,
    MakePlatform = require('enb/lib/make'),
    MagicConfig = require('./magic-config'),
    fixTarget = require('./utils').fixTarget,
    EVENTS = {
        START: 'start',
        PREBUILD: 'prebuild',
        BUILD: 'build',
        ERROR: 'error',
        END: 'end'
    },
    MODES = {
        FULL: 'full',
        PRE: 'pre'
    };

/**
 * Хэлпер предназначен для решения задач, связанных с созданием новых нод и таргетов в процессе выполнения сборки.
 *
 * В процессе создания конфигуратора будет зарегистрирован таск c указанным именем, который предназначается для:
 * 1. Создания директорий и файлов, формирующих уровни-сеты.
 * 2. Регистрации нод и таргетов по созданным директориям и файлам.
 * 3. Запуска сборки зарегистрированных таргетов, а также всех таргетов в рамках зарегистрированных нод.
 *
 * Общение между хэлперами происходит через каналы событий. По умолчанию каждый из хэлперов создаёт следующие события:
 *
 * 1. **start** `function () { }`
 *
 * Срабатывает, когда происходит запуск таска.
 *
 * 2. **prebuild** `function (nodes, targets) { }`
 *
 * Срабатывает после создания всех уровней-сетов на файловой системе. Возвращает список всех зарегистрированных `nodes`,
 * а также список всех зарегистрированных таргетов `targets` ноды, которых не были зарегистрированны.
 *
 * 3. **build** `function (buildInfo) { }`
 *
 * Срабатывает в случае успешного завершения сборки, возвращая информацию о собранных таргетов.
 *
 * 4. **error** `function (err) { }`
 *
 * Срабатывает при возникновении ошибки в процессе построения или сборки уровней-сетов.
 *
 * 5. **end** `function () { }`
 *
 * Срабатывает когда завершается выполнение таска.
 *
 * Таск может работать в нескольких режимах:
 *
 * 1. `full` — сборка выполняется для всех целей. Если в качестве цели задана нода или директория с нодами,
 *             то цель будет раскрыта до всех таргетов в рамках заданной ноды или директории.
 * 2. `pre`  — сборка выполняется только для тех целей, которые являются конечными таргетами (файлами),
 *             для остальных выполняется только `prebuild`.
 *
 * По умолчанию таск работает в `full`-режиме.
 *
 * @name MagicHelper
 * @extends EventEmitter
 * @param {String} taskName
 * @param {ProjectConfig} projectConfig
 * @constructor
 */
function MagicHelper(taskName, projectConfig) {
    this._mode = MODES.FULL;
    this._configures = [];
    this._prebuilds = [];

    this._taskName = taskName;
    this._projectConfig = projectConfig;
    this._eventChannel = new EventEmitter();

    this._configureTask();
}

/**
 * Возвращает название таска, в котором происходит создание и нод и таргетов.
 *
 * @returns {String}
 */
MagicHelper.prototype.getTaskName = function () {
    return this._taskName;
};

/**
 * Возвращает название режима сборки.
 *
 * @returns {String}
 */
MagicHelper.prototype.getMode = function () {
    return this._mode;
};

/**
 * Задаёт режим сборки.
 *
 * @param {String} mode
 */
MagicHelper.prototype.setMode = function (mode) {
    this._mode = mode;
};

/**
 * Возвращает путь к корню проекта.
 *
 * @returns {String}
 */
MagicHelper.prototype.getRootPath = function () {
    return this._projectConfig.getRootPath();
};

/**
 * Возвращает канал событий данного хэлпера.
 *
 * @returns {EventEmitter}
 */
MagicHelper.prototype.getEventChannel = function () {
    return this._eventChannel;
};

/**
 * Позволяет декларировать создание нод и таргетов на файловой системе для последующей их сборки.
 * Функции `callback` первым аргументом будет передан инстанс `MagicConfig`.
 *
 * Предполагается, что в функции `callback` будут производиться некие действия по созданию нод и таргетов
 * на файловой системе, которые будут зарегистрированы с помощью `MagicConfig`.
 *
 * Если несколько раз задекларировать создание уровней-сетов, то каждая такая `callback` функция будет выполняться
 * асинхронно, т.е. независимо от остальных.
 *
 * @param {Function} callback
 */
MagicHelper.prototype.prebuild = function (callback) {
    this._prebuilds.push(callback);
};

/**
 * Позволяет декларировать сборку нод и таргетов.
 * Функции `callback` первым аргументом будет передан инстанс `ProjectConfig`.
 *
 * Можно использовать любые методы для конфигурирования нод (`node`, `nodes`, `nodeMask`), т.к. выполнение `callback`
 * функций будет происходить после этапа создания нод и таргетов на файловой системе.
 *
 * @param {Function} callback
 */
MagicHelper.prototype.configure = function (callback) {
    this._configures.push(callback);
};

MagicHelper.prototype._configureTask = function () {
    var _this = this,
        projectConfig = this._projectConfig,
        taskName = this._taskName,
        channel = this._eventChannel;

    projectConfig.task(taskName, function (task) {
        channel.emit(EVENTS.START);

        var logger = task._logger,
            args = [].slice.call(arguments, 1),
            magicConfig = new MagicConfig(args);

        // Запускаем сборку задекларированных `callback`-функций
        return vow.all(_this._prebuilds.map(function (callback) {
                return callback.apply(this, [magicConfig, logger]);
            }))
            .then(function () {
                var registeredNodes = magicConfig.getRegisteredNodes(),
                    targets = magicConfig.getRegisteredTargets(),
                    nodes = magicConfig.getNodes(),
                    toBuild = {},
                    nodesToBuild = {},
                    targetsToBuild = {},
                    buildInfo = { builtTargets: [] },
                    mode = _this._mode;

                channel.emit(EVENTS.PREBUILD, registeredNodes, targets);

                // Ничего не делаем, если нет зарегистрированных нод и таргетов
                if (nodes.length === 0 && targets.length === 0) {
                    channel.emit(EVENTS.BUILD, buildInfo);

                    return vow.resolve(buildInfo);
                }

                // Собираем все ноды, если пользователь не указал ожидаемых целей
                if (!args.length && mode === MODES.FULL) {
                    return _this._buildTargets(nodes, nodes, []);
                }

                // Раскрываем цели в список нод и таргетов для сборки
                args.forEach(function (arg) {
                    arg = fixTarget(arg);

                    // Добавляем цель в сборку, если она была зарегистрированна
                    // или входит в явно или косвенно зарегистрированную ноду
                    if (magicConfig.isRegisteredTarget(arg) || nodes.indexOf(path.dirname(arg)) !== -1) {
                        targetsToBuild[arg] = true;
                        toBuild[arg] = true;
                    }

                    // В `full` режиме в сборку попадают цели, даже если они не являются конечными таргетами (файлами)
                    if (mode === MODES.FULL && magicConfig.isRequiredNode(arg)) {
                        // Раскрываем цель в список нод
                        nodes.forEach(function (node) {
                            if (node.indexOf(arg) === 0) {
                                nodesToBuild[node] = true;
                                toBuild[node] = true;
                            }
                        });
                    }

                    // В `pre` режиме в сборку попадают только зарегистрированные ноды
                    if (mode === MODES.PRE && magicConfig.isRegisteredNode(arg)) {
                        nodesToBuild[arg] = true;
                        toBuild[arg] = true;
                    }
                });

                toBuild = Object.keys(toBuild);
                nodesToBuild = Object.keys(nodesToBuild);
                targetsToBuild = Object.keys(targetsToBuild);

                // Не вызываем сборку если не оказалось таргетов для сборки
                if (toBuild.length === 0) {
                    channel.emit(EVENTS.BUILD, buildInfo);

                    return vow.resolve(buildInfo);
                }

                return _this._buildTargets(toBuild, nodesToBuild, targetsToBuild);
            });
    });

    this._taskConfig = projectConfig.getTaskConfig(taskName);
};

MagicHelper.prototype._buildTargets = function (toBuild, nodes, targets) {
    var baseMakePlatform = this._taskConfig.getMakePlatform(),
        makePlatform = new MakePlatform(),
        root = this.getRootPath(),
        configures = this._configures,
        channel = this._eventChannel,
        argv = parseArgs(process.argv.slice(2), {
            boolean: ['no-cache'],
            alias: { 'no-cache': 'n' },
            unknown: function () { return false; }
        }),
        useCache = !argv['no-cache'];

    return makePlatform.init(root)
        .then(function () {
            if (useCache) {
                // Используем кэш основной make-платформы
                makePlatform._cacheStorage = baseMakePlatform._cacheStorage;
            }

            // Используем логгер основной make-платформы
            makePlatform.setLogger(baseMakePlatform.getLogger());

            // Донастраиваем сборку специфично для текущего таска
            configures.length && configures.forEach(function (f) {
                f.apply(null, [makePlatform._projectConfig, nodes, targets]);
            });

            return makePlatform.buildTargets(toBuild);
        })
        .then(function (buildInfo) {
            if (useCache) {
                // Не даём очистить закэшированные данные основной make-платформы,
                // т.к. они могут понадобится для остальных тасков
                makePlatform._cacheStorage = undefined;
            }

            makePlatform.destruct();

            channel.emit(EVENTS.BUILD, buildInfo);

            return buildInfo;
        })
        .fail(function (err) {
            makePlatform.destruct();

            channel.emit(EVENTS.ERROR, err);

            throw err;
        });
};

module.exports = MagicHelper;
