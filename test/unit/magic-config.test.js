var MagicConfig = require('./../../lib/magic-config');

describe('magic-config', function () {
    it('must register target', function () {
        var config = new MagicConfig();

        config.registerTarget('path/to/node/target');
        config.isRegisteredTarget('path/to/node/target').must.be.true();
    });

    it('must register existing target', function () {
        var config = new MagicConfig();

        config.registerTarget('path/to/node/target');
        config.registerTarget('path/to/node/target');

        config.getRegisteredTargets().must.eql(['path/to/node/target']);
    });

    it('must register targets', function () {
        var config = new MagicConfig(),
            nodes;

        config.registerTargets(['path/to/node/target-1', 'path/to/node/target-2']);
        nodes = config.getRegisteredTargets();

        nodes.must.have.length(2);
        nodes.must.include('path/to/node/target-1');
        nodes.must.include('path/to/node/target-2');
    });

    it('must register node', function () {
        var config = new MagicConfig();

        config.registerNode('path/to/node');
        config.isRegisteredNode('path/to/node').must.be.true();
    });

    it('must register existing node', function () {
        var config = new MagicConfig();

        config.registerNode('path/to/node');
        config.registerNode('path/to/node');

        config.getRegisteredNodes().must.eql(['path/to/node']);
    });

    it('must register nodes', function () {
        var config = new MagicConfig(),
            nodes;

        config.registerNodes(['path/to/node-1', 'path/to/node-2']);
        nodes = config.getRegisteredNodes();

        nodes.must.have.length(2);
        nodes.must.include('path/to/node-1');
        nodes.must.include('path/to/node-2');
    });

    it('must detect node by registered target', function () {
        var config = new MagicConfig();

        config.registerTarget('path/to/node/target');
        config.hasNode('path/to/node').must.be.true();
    });

    it('must detect node by registered node', function () {
        var config = new MagicConfig();

        config.registerNode('path/to/node');
        config.hasNode('path/to/node').must.be.true();
    });

    it('must get nodes if has registered node & target', function () {
        var config = new MagicConfig(),
            nodes;

        config.registerNode('path/to/node-1');
        config.registerTarget('path/to/node-2/target');
        nodes = config.getNodes();

        nodes.must.have.length(2);
        nodes.must.include('path/to/node-1');
        nodes.must.include('path/to/node-2');
    });

    it('must register target if it is included in registered node', function () {
        var config = new MagicConfig();

        config.registerNode('path/to/node');
        config.registerTarget('path/to/node/target');

        config.isRegisteredTarget('path/to/node/target').must.be.true();
    });

    it('must not register dot node', function () {
        var config = new MagicConfig();

        config.registerNode('path/to/.node');

        config.isRegisteredNode('path/to/.node').must.be.false();
    });

    it('must not register dot target', function () {
        var config = new MagicConfig();

        config.registerTarget('path/to/node/.target');

        config.isRegisteredNode('path/to/node/.target').must.be.false();
    });

    it('must fit any target if not specified requiredTargets', function () {
        var config = new MagicConfig();

        config.isRequiredTarget('path/to/node/target').must.be.true();
    });

    it('must considered equal path with last slash and path without slash', function () {
        var config = new MagicConfig(['path/with/last-slash/', 'path/without/last-slash']);

        config.isRequiredTarget('path/without/last-slash/').must.be.true();
        config.isRequiredTarget('path/without/last-slash').must.be.true();

        config.isRequiredTarget('path/with/last-slash/').must.be.true();
        config.isRequiredTarget('path/with/last-slash').must.be.true();
    });

    it('must detect required node', function () {
        var config = new MagicConfig(['path/to/node']);

        config.isRequiredNode('path/to/node').must.be.true();
    });

    it('must detect required target', function () {
        var config = new MagicConfig(['path/to/node/target']);

        config.isRequiredTarget('path/to/node/target').must.be.true();
    });

    it('must detect target in required node', function () {
        var config = new MagicConfig(['path/to/node']);

        config.isRequiredTarget('path/to/node/target').must.be.true();
    });

    it('must not detect target in non required node', function () {
        var config = new MagicConfig(['path/to/other-node']);

        config.isRequiredTarget('path/to/node/target').must.be.false();
    });

    it('must detect node in deep required node', function () {
        var config = new MagicConfig(['path/to/node']);

        config.isRequiredNode('path/to/node/deep-node').must.be.true();
    });

    it('must detect target in deep required node', function () {
        var config = new MagicConfig(['path/to/node']);

        config.isRequiredTarget('path/to/node/deep-node/target').must.be.true();
    });

    it('must detect node if required target in specified node', function () {
        var config = new MagicConfig(['path/to/node/target']);

        config.isRequiredNode('path/to/node').must.be.true();
    });
});
