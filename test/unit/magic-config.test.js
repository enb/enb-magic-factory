var MagicConfig = require('./../../lib/magic-config'),
    path = require('path'),
    nodePath = path.join('path', 'to', 'node'),
    targetPath = path.join(nodePath, 'target');

describe('magic-config', function () {
    it('must register target', function () {
        var config = new MagicConfig();

        config.registerTarget(targetPath);
        config.isRegisteredTarget(targetPath).must.be.true();
    });

    it('must register existing target', function () {
        var config = new MagicConfig();

        config.registerTarget(targetPath);
        config.registerTarget(targetPath);

        config.getRegisteredTargets().must.eql([targetPath]);
    });

    it('must register targets', function () {
        var config = new MagicConfig(),
            nodes;

        config.registerTargets([
            path.join(nodePath, 'target-1'),
            path.join(nodePath, 'target-2')
        ]);
        nodes = config.getRegisteredTargets();

        nodes.must.have.length(2);
        nodes.must.include(path.join(nodePath, 'target-1'));
        nodes.must.include(path.join(nodePath, 'target-2'));
    });

    it('must register node', function () {
        var config = new MagicConfig();

        config.registerNode(nodePath);
        config.isRegisteredNode(nodePath).must.be.true();
    });

    it('must register existing node', function () {
        var config = new MagicConfig();

        config.registerNode(nodePath);
        config.registerNode(nodePath);

        config.getRegisteredNodes().must.eql([nodePath]);
    });

    it('must register nodes', function () {
        var config = new MagicConfig(),
            nodes;

        config.registerNodes([path.join('path', 'to', 'node-1'), path.join('path', 'to', 'node-2')]);
        nodes = config.getRegisteredNodes();

        nodes.must.have.length(2);
        nodes.must.include(path.join('path', 'to', 'node-1'));
        nodes.must.include(path.join('path', 'to', 'node-2'));
    });

    it('must detect node by registered target', function () {
        var config = new MagicConfig();

        config.registerTarget(path.join(nodePath, 'target'));
        config.hasNode(nodePath).must.be.true();
    });

    it('must detect node by registered node', function () {
        var config = new MagicConfig();

        config.registerNode(nodePath);
        config.hasNode(nodePath).must.be.true();
    });

    it('must get nodes if has registered node & target', function () {
        var config = new MagicConfig(),
            nodes;

        config.registerNode(path.join('path', 'to', 'node-1'));
        config.registerTarget(path.join('path', 'to', 'node-2', 'target'));
        nodes = config.getNodes();

        nodes.must.have.length(2);
        nodes.must.include(path.join('path', 'to', 'node-1'));
        nodes.must.include(path.join('path', 'to', 'node-2'));
    });

    it('must register target if it is included in registered node', function () {
        var config = new MagicConfig();

        config.registerNode(nodePath);
        config.registerTarget(targetPath);

        config.isRegisteredTarget(targetPath).must.be.true();
    });

    it('must not register dot node', function () {
        var config = new MagicConfig();

        config.registerNode(path.join('path', 'to', '.node'));

        config.isRegisteredNode(path.join('path', 'to', '.node')).must.be.false();
    });

    it('must not register dot target', function () {
        var config = new MagicConfig();

        config.registerTarget(path.join(nodePath, '.target'));

        config.isRegisteredNode(path.join(nodePath, '.target')).must.be.false();
    });

    it('must fit any target if not specified requiredTargets', function () {
        var config = new MagicConfig();

        config.isRequiredTarget(targetPath).must.be.true();
    });

    it('must considered equal path with last slash and path without slash', function () {
        var config = new MagicConfig([
            path.join('path', 'with', 'last-slash', path.sep),
            path.join('path', 'without', 'last-slash')
        ]);

        config.isRequiredTarget(path.join('path', 'without', 'last-slash', path.sep)).must.be.true();
        config.isRequiredTarget(path.join('path', 'without', 'last-slash')).must.be.true();

        config.isRequiredTarget(path.join('path', 'with', 'last-slash', path.sep)).must.be.true();
        config.isRequiredTarget(path.join('path', 'with', 'last-slash')).must.be.true();
    });

    it('must considered equal path with `.` and path without `.`', function () {
        var config = new MagicConfig([
            '.' + path.sep + path.join('path', 'with', 'point'),
            path.join('path', 'without', 'point')
        ]);

        config.isRequiredTarget('.' + path.sep + path.join('path', 'without', 'point')).must.be.true();
        config.isRequiredTarget(path.join('path', 'without', 'point')).must.be.true();

        config.isRequiredTarget('.' + path.sep + path.join('path', 'with', 'point')).must.be.true();
        config.isRequiredTarget(path.join('path', 'with', 'point')).must.be.true();
    });

    it('must detect required node', function () {
        var config = new MagicConfig([nodePath]);

        config.isRequiredNode(nodePath).must.be.true();
    });

    it('must detect required target', function () {
        var config = new MagicConfig([targetPath]);

        config.isRequiredTarget(targetPath).must.be.true();
    });

    it('must detect target in required node', function () {
        var config = new MagicConfig([nodePath]);

        config.isRequiredTarget(targetPath).must.be.true();
    });

    it('must not detect target in non required node', function () {
        var config = new MagicConfig([path.join('path', 'to', 'other-node')]);

        config.isRequiredTarget(targetPath).must.be.false();
    });

    it('must detect node in deep required node', function () {
        var config = new MagicConfig([nodePath]);

        config.isRequiredNode(path.join(nodePath, 'deep-node')).must.be.true();
    });

    it('must detect target in deep required node', function () {
        var config = new MagicConfig([nodePath]);

        config.isRequiredTarget(path.join(nodePath, 'deep-node', 'target')).must.be.true();
    });

    it('must detect node if required target in specified node', function () {
        var config = new MagicConfig([targetPath]);

        config.isRequiredNode(nodePath).must.be.true();
    });
});
