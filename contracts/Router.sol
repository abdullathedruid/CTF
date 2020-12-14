pragma solidity ^0.6.0;

import "./interfaces/ISCMMaker.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ABDKMath} from "./ABDKMath64x64.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

contract Router is IERC1155Receiver{

  address private currency;

  constructor(address _curr) public {
    currency = _curr;
  }

  function buySingleEvent(address _event, uint _outcome, int128 _amount) public {
    IERC20(currency).approve(_event,ABDKMath.mulu(_amount,10**18));
    int128 transfer = ISCMMaker(_event).buyshares(msg.sender,_outcome,_amount);
    require(IERC20(currency).transferFrom(msg.sender,address(this),ABDKMath.mulu(transfer,10**18)));
  }

  /* function buyComboEvent(address[] memory _events, uint[] memory _outcomes, int128 _amount) public {
    require(_events.length == _outcomes.length,'mismatch length');
    for(uint i=0;i<_events.length;i++) {
      ISCMMaker(_events[i]).buyshares(address(this),_outcome,_amount)
    }
  } */

  function onERC1155Received(
    address operator,
    address from,
    uint256 id,
    uint256 value,
    bytes calldata data
)
    external
    override
    returns(bytes4) {
        return this.onERC1155Received.selector;
    }

function onERC1155BatchReceived(
    address operator,
    address from,
    uint256[] calldata ids,
    uint256[] calldata values,
    bytes calldata data
)
    external
    override
    returns(bytes4) {
        return this.onERC1155BatchReceived.selector;
    }

function supportsInterface(bytes4 interfaceId) external override view returns (bool) {}
}
