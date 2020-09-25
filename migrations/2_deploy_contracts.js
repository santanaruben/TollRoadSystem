const Regulator = artifacts.require("Regulator");
const TollBoothOperator = artifacts.require("TollBoothOperator");

module.exports = function (deployer, network, accounts) {
  [owner1, owner2] = accounts;
  // var owner1 = '0xe13DCbbCd79DFdA44fBA5348583240589cb690d7';
  // var owner2 = '0x9EaBFB44EA9Da4c0bbCbbD32f0103D1f7868aB7a';
  const deposit = 100;
  var reg;

  deployer.deploy(Regulator)
    .then(function(deployed) {
      reg = deployed;
      return reg;
    })
    .then(function(regulator) {
      return regulator.createNewOperator(owner2, deposit, {
        from: owner1
      });
    })
    .then(function(tx) {
      const operator = tx.receipt.logs[1].args.newOperator;
      return TollBoothOperator.at(operator);
    })
    .then(function(tbo) {
      return tbo.setPaused(false, {
        from: owner2
      });
    })
};