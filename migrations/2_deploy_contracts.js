var Dai = artifacts.require('./FakeDai.sol');
var ConditionalTokens = artifacts.require('./ConditionalTokens.sol');
var SCFactory = artifacts.require('SCFactory')

module.exports = async function(deployer) {
  await deployer.deploy(Dai);
  const DAI = await Dai.deployed();

  await deployer.deploy(ConditionalTokens);
  const CT = await ConditionalTokens.deployed();

  await deployer.deploy(SCFactory);
  const SCFACTORY = await SCFactory.deployed();

}
