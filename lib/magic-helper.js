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
    this._chains = [];

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
 * Возвращает конфиг, с помощью которого производится настройка сборки нод и таргетов.
 *
 * @returns {ProjectConfig}
 */
MagicHelper.prototype.getProjectConfig = function () {
    return this._projectConfig;
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
    this._chains.push(callback);
};

MagicHelper.prototype._configureTask = function () {
    var _this = this;
    var projectConfig = this._projectConfig;
    var taskName = this._taskName;
    var channel = this._eventChannel;

    projectConfig.task(taskName, function () {
        channel.emit('start');

        var args = [].slice.call(arguments, 1);
        var magicConfig = new MagicConfig(args);

        // Запускаем сборку задекларированных `callback`-функций
        return vow.all(_this._chains.map(function (callback) {
                return callback.apply(this, [magicConfig]);
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
                    return _this._buildTargets(nodes);
                }

                // Раскрываем цели в список нод и таргетов для сборки
                args.forEach(function (arg) {
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

                return _this._buildTargets(Object.keys(toBuild));
            });
    });

    this._taskConfig = projectConfig.getTaskConfig(taskName);
};

MagicHelper.prototype._buildTargets = function (targets) {
    var task = this._taskConfig;
    var root = task.getMakePlatform().getDir();
    var makePlatform = new MakePlatform();
    var projectConfig = this._projectConfig;
    var channel = this._eventChannel;

    return makePlatform.init(root)
        .then(function () {
            makePlatform.loadCache();

            var nodeConfigs = {};
            var baseNodeConfigs = makePlatform._projectConfig._nodeConfigs;
            var magicNodeConfigs = projectConfig._nodeConfigs;

            // Объединяем ноды заделкарированные в процессе `prebuild` с базовой декларацией
            Object.keys(magicNodeConfigs).forEach(function (node) {
                var base = baseNodeConfigs[node];
                var magic = magicNodeConfigs[node];

                // Если базовые декларации ешё не содержат в себе ноды заделкарированные в процессе `prebuild`
                if (base && (base._chains.length > magic._chains.length)) {
                    base._chains = [].concat(base._chains, magic._chains);

                    nodeConfigs[node] = base;
                } else {
                    nodeConfigs[node] = magic;
                }
            });

            makePlatform._projectConfig._nodeConfigs = nodeConfigs;

            return makePlatform.buildTargets(targets);
        })
        .then(function () {
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
