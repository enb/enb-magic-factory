var vow = require('vow');
var MagicHelper = require('./magic-helper');

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
 *
 * @name MagicFactory
 * @param projectConfig {ProjectConfig}
 * @constructor
 */
var MagicFactory = function (projectConfig) {
    this._projectConfig = projectConfig;
    this._helpers = {};

    this._magicTaskName = process.env.ENB_MAGIC_TASK || '__magic__';
    this._configureMagicTask();
};

/**
 * Создаёт хэлпер.
 *
 * @param {String} taskName
 * @returns {MagicHelper}
 */
MagicFactory.prototype.createHelper = function (taskName) {
    return (this._helpers[taskName] = new MagicHelper(taskName, this._projectConfig));
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

MagicFactory.prototype._configureMagicTask = function () {
    var _this = this;

    this._projectConfig.task(this._magicTaskName, function (task) {
        var taskNames = Object.keys(_this._helpers);
        var args = [].slice.call(arguments, 1);
        var makePlatform = task.getMakePlatform();

        return vow.all(taskNames.map(function (taskName) {
            return makePlatform.buildTask(taskName, args);
        }));
    });
};

/**
 * Регистрирует модуль
 *
 * @param {ProjectConfig} projectConfig
 */
module.exports = function (projectConfig) {
    projectConfig.registerModule('enb-magic-factory', new MagicFactory(projectConfig));
};
