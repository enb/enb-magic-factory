var MODULE_NAME = 'enb-magic-factory',
    MagicFactory = require('./magic-factory');

/**
 * Регистрирует модуль.
 *
 * @param {ProjectConfig} projectConfig
 */
module.exports = function (projectConfig) {
    if (!projectConfig._modules[MODULE_NAME]) {
        projectConfig.registerModule(MODULE_NAME, new MagicFactory(projectConfig));
    }
};
