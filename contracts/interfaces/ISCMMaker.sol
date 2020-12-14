pragma solidity >=0.6;

interface ISCMMaker {
  function buyshares(address _user, uint _outcome, int128 amount) external returns (int128 spot_price);
}
