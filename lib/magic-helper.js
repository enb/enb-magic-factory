var path = require('path');
var vow = require('vow');
var EventEmitter = require('events').EventEmitter;
var MakePlatform = require('enb/lib/make');
var MagicConfig = require('./magic-config');

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
 * 3. **build** `function (targets) { }`
 *
 * Срабатывает в случае успешного завершения сборки, возвращая список собранных таргетов.
 *
 * 4. **error** `function (err) { }`
 *
 * Срабатывает при возникновении ошибки в процессе построения или сборки уровней-сетов.
 *
 * @name MagicHelper
 * @extends EventEmitter
 * @param {String} taskName
 * @param {ProjectConfig} projectConfig
 * @constructor
 */
var MagicHelper = function (taskName, projectConfig) {
    this._configures = [];
    this._prebuilds = [];

    this._taskName = taskName;
    this._projectConfig = projectConfig;
    this._eventChannel = new EventEmitter();

    this._configureTask();
};

/**
 * Возвращает название таска, в котором происходит создание и нод и таргетов.
 *
 * @returns {String}
 */
MagicHelper.prototype.getTaskName = function () {
    return this._taskName;
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
    var _this = this;
    var projectConfig = this._projectConfig;
    var taskName = this._taskName;
    var channel = this._eventChannel;

    projectConfig.task(taskName, function (task) {
        channel.emit('start');

        var logger = task._logger;
        var args = [].slice.call(arguments, 1);
        var magicConfig = new MagicConfig(args);

        // Запускаем сборку задекларированных `callback`-функций
        return vow.all(_this._prebuilds.map(function (callback) {
                return callback.apply(this, [magicConfig, logger]);
            }))
            .then(function () {
                var registeredNodes = magicConfig.getRegisteredNodes();
                var targets = magicConfig.getRegisteredTargets();
                var nodes = magicConfig.getNodes();
                var toBuild = {};

                channel.emit('prebuild', registeredNodes, targets);

                // Ничего не делаем, если нет зарегистрированных нод и таргетов
                if (nodes.length === 0 && targets.length === 0) {
                    channel.emit('build', []);

                    return vow.resolve([]);
                }

                // Собираем все ноды, если пользователь не указал ожидаемых целей
                if (!args.length) {
                    return _this._buildTargets(nodes, nodes);
                }

                // Раскрываем цели в список нод и таргетов для сборки
                args.forEach(function (arg) {
                    arg = arg.replace(/\/$/, '');

                    // Добавляем цель в сборку, если она была зарегистрированна
                    // или входит в явно или косвенно зарегистрированную ноду
                    if (magicConfig.isRegisteredTarget(arg) || nodes.indexOf(path.dirname(arg)) !== -1) {
                        toBuild[arg] = true;
                    }

                    if (magicConfig.isRequiredNode(arg)) {
                        // Раскрываем цель в список нод
                        nodes.forEach(function (node) {
                            if (node.indexOf(arg) === 0) {
                                toBuild[node] = true;
                            }
                        });
                    }
                });

                return _this._buildTargets(Object.keys(toBuild), nodes);
            });
    });

    this._taskConfig = projectConfig.getTaskConfig(taskName);
};

MagicHelper.prototype._buildTargets = function (targets, nodes) {
    var baseMakePlatform = this._taskConfig.getMakePlatform();
    var makePlatform = new MakePlatform();
    var root = this.getRootPath();
    var configures = this._configures;
    var channel = this._eventChannel;

    return makePlatform.init(root)
        .then(function () {
            // Используем кэш основной make-платформы
            makePlatform._cacheStorage = baseMakePlatform._cacheStorage;
            makePlatform.loadCache();

            // Донастраиваем сборку специфично для текущего таска
            configures.length && configures.forEach(function (f) {
                f.apply(null, [makePlatform._projectConfig, nodes]);
            });

            return makePlatform.buildTargets(targets);
        })
        .then(function () {
            makePlatform.saveCache();
            makePlatform._cacheStorage = undefined; // Не даём очистить закэшированные данные основной make-платформы,
                                                    // т.к. они могут понадобится для остальных тасков
            makePlatform.destruct();

            channel.emit('build', targets);

            return targets;
        })
        .fail(function (err) {
            makePlatform.destruct();
            channel.emit('error', err);

            throw err;
        });
};

module.exports = MagicHelper;
