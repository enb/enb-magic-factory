var vow = require('vow'),
    MagicHelper = require('./magic-helper'),
    STATES = {
        INITIALIZED: 'initialized',
        RUNNING: 'running',
        FULFILLED: 'fulfilled',
        FAILED: 'failed'
    };

/**
 * Фабрика позволяет создавать конфигураторы, помогающие описывать процесс создания новых нод и таргетов. Конфигураторы
 * декларируют процесс создания новых нод и таргетов в тасках.
 *
 * Для удобства использования тасков, создающих ноды и таргеты в процессе выполнения сборки, регистрируется специальный
 * мета-таск, аргументами которого являются ноды или таргеты, которые могут быть не созданы на файловой системе
 * и не задекларированы посредством `ProjectConfig` до запуска процесса сборки.
 *
 * Мета-таск инкапсулирует в себе знания о всех тасках, которые будут зарегистрированы с помощью хелперов, созданных
 * посредством данного модуля. Название этого таска задаётся через переменную окружения `process.env.ENB_MAGIC_TASK`.
 * По умолчанию мета-таск имеет название `__magic__`.
 *
 * @name MagicFactory
 * @param {ProjectConfig} projectConfig
 * @constructor
 */
function MagicFactory(projectConfig) {
    this._state = STATES.INITIALIZED;
    this._projectConfig = projectConfig;
    this._helpers = {};
    this._channels = {};

    this._magicTaskName = process.env.ENB_MAGIC_TASK || '__magic__';
    this._configureMagicTask();
}

/**
 * Создаёт хэлпер.
 *
 * @param {String} taskName
 * @returns {MagicHelper}
 */
MagicFactory.prototype.createHelper = function (taskName) {
    var helper = new MagicHelper(taskName, this._projectConfig);

    helper._factory = this;

    this._helpers[taskName] = helper;
    this._channels[taskName] = helper.getEventChannel();

    return helper;
};

/**
 * Возвращает хэлпер по названию таска.
 *
 * @param {String} taskName
 * @returns {MagicHelper}
 */
MagicFactory.prototype.getHelper = function (taskName) {
    return this._helpers[taskName];
};

/**
 * Возвращает канал событий по названию таска.
 *
 * @param {String} taskName
 * @returns {EventEmitter}
 */
MagicFactory.prototype.getEventChannel = function (taskName) {
    return this._channels[taskName];
};

/**
 * Возвращает состояние мета-таска.
 *
 * `initialized` — проинициализирован (не запускался ранее).
 * `running` — выполняется.
 * `fulfilled` — успешно завершил работу.
 * `failed` — завершил работу с ошибкой.
 *
 * @returns {String}
 */
MagicFactory.prototype.getMetaTaskState = function () {
    return this._state;
};

MagicFactory.prototype._configureMagicTask = function () {
    var _this = this;

    this._projectConfig.task(this._magicTaskName, function (task) {
        var taskNames = Object.keys(_this._helpers),
            args = [].slice.call(arguments, 1),
            makePlatform = task.getMakePlatform();

        _this._state = STATES.RUNNING;

        return vow.all(taskNames.map(function (taskName) {
                return makePlatform.buildTask(taskName, args);
            }))
            .then(function () {
                _this._state = STATES.FULFILLED;
            })
            .fail(function () {
                _this._state = STATES.FAILED;
            });
    });
};

/**
 * Регистрирует модуль
 *
 * @param {ProjectConfig} projectConfig
 */
module.exports = function (projectConfig) {
    var name = 'enb-magic-factory';

    if (!projectConfig._modules[name]) {
        projectConfig.registerModule(name, new MagicFactory(projectConfig));
    }
};
