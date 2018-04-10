var RockPaperScissorsGame = artifacts.require("./RockPaperScissorsGame.sol");

module.exports = function(deployer, network, accounts) {
  deployer.deploy(RockPaperScissorsGame, true);
};
