var Dai = artifacts.require('./FakeDai.sol');
var ConditionalTokens = artifacts.require('./ConditionalTokens.sol');
var SCFactory = artifacts.require('SCFactory')
var Arbitrator = artifacts.require('SimpleCentralizedArbitrator')
var Router = artifacts.require('Router')

module.exports = async function(deployer) {
  await deployer.deploy(Dai);
  const DAI = await Dai.deployed();

  await deployer.deploy(ConditionalTokens);
  const CT = await ConditionalTokens.deployed();

  await deployer.deploy(SCFactory,DAI.address, CT.address);
  const SCFACTORY = await SCFactory.deployed();

  await deployer.deploy(Router,DAI.address, CT.address);
  const ROUTER = await Router.deployed()

  DAI.mint(ROUTER.address,'1000000000000000000000')

}

//web3.eth.sendTransaction({ from: '0x76819C75A08E39445E5F033A5fF8d87c6F4898Dd', to: '0xCAB5f6B9004F1cc65eAEf965cCca998A598Cc968', value: '10000000000000000000' })
