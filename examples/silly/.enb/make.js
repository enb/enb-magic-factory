var fs = require('fs');
var path = require('path');

module.exports = function (config) {
    config.includeConfig(require.resolve('../../../lib/index.js'));

    var root = config.getRootPath();
    var factory = config.module('enb-magic-factory');
    var helper = factory.createHelper('my-task');
    var node = 'node';
    var nodePath = path.join(root, node);
    var target = path.join(node, 'node.txt');
    var targetPath = path.join(root, target);

    // Создаём таргет на файловой системе на лету
    helper.prebuild(function (magic) {
        !fs.existsSync(nodePath) && fs.mkdirSync(nodePath);
        !fs.existsSync(targetPath) && fs.writeFileSync(targetPath, 'Valar Morghulis');

        magic.registerTarget(target);
    });

    // Настраиваем сборку таргета
    config.node(node, function (nodeConfig) {
        nodeConfig.addTech([require('enb/techs/file-provider'), { target: '?.txt' }]);
        nodeConfig.addTarget('?.txt');
    });

    // Доопределяем `clean`-таск
    config.task('clean', function () {
        if (fs.existsSync(nodePath)) {
            fs.existsSync(targetPath) && fs.unlinkSync(targetPath);
            fs.rmdirSync(nodePath);
        }
    });
};
