var vow = require('vow');
var EventEmitter = require('events').EventEmitter;
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

    projectConfig.task(taskName, function (task) {
        var args = [].slice.call(arguments, 1);
        var magicConfig = new MagicConfig(args);

        _this._startTime = new Date();
        task.log('building started');
        channel.emit('start');

        // Запускаем сборку задекларированных `callback`-функций
        return vow.all(_this._chains.map(function (callback) {
                return callback.apply(this, [magicConfig]);
            }))
            .then(function () {
                channel.emit('prebuild', magicConfig.getRegisteredNodes(), magicConfig.getRegisteredTargets());

                // Формируем цели для сборки
                var toBuild = magicConfig.toBuild();

                // Ничего не делаем, если нет нод и таргетов для сборки
                if (args.length && toBuild.length === 0) {
                    return vow.resolve([]);
                }

                return _this._buildTargets(toBuild);
            });
    });

    this._taskConfig = projectConfig.getTaskConfig(taskName);
};

MagicHelper.prototype._buildTargets = function (targets) {
    var startTime = this._startTime;
    var task = this._taskConfig;
    var makePlatform = task.getMakePlatform();
    var root = makePlatform.getDir();
    var channel = this._eventChannel;

    return makePlatform.init(root)
        .then(function () {
            makePlatform.loadCache();

            return makePlatform.buildTargets(targets);
        })
        .then(function () {
            task.log('building finished - ' + (new Date() - startTime) + 'ms');

            channel.emit('build', targets);

            return targets;
        })
        .fail(function (err) {
            task.log('building failed');

            channel.emit('error', err);

            throw err;
        });
};

module.exports = MagicHelper;
