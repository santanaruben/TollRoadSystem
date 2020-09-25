module.exports = {
    networks: {
        development: {
            host: "127.0.0.1",     // Localhost (default: none)
            port: 7545,            // Standard Ethereum port (default: none)
            network_id: "*",       // Any network (default: none)
            gas: 15000000
           },
        net42: {
            host: "0.0.0.0",
            port: 8545,
            network_id: 42,
            gas: 8000000
        },
    }
};