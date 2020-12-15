pragma solidity >=0.6;

interface ISCMMaker {
  function buyshares(address _user, uint _outcome, int128 amount) external returns (int128 spot_price);
  function buyvirtualshares(address _user, uint _outcome, int128 amount) external returns (int128 spot_price);
  function getCondition() external view returns (bytes32);
  function getNumberOutcomes() external view returns (uint);
  function priceU(uint _outcome, int128 amount) external view returns (uint256);
  function priceI(uint _outcome, int128 amount) external view returns (int128);
}
