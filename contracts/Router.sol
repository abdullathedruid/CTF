pragma solidity ^0.6.0;

import "./interfaces/ISCMMaker.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ABDKMath} from "./ABDKMath64x64.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "./ConditionalTokens.sol";

contract Router is IERC1155Receiver{

  address private currency;
  address private CT;

  event BetCreated(address indexed _event, uint _outcome, int128 _amount);
  event ComboBetCreated(address[] indexed _events, uint[] _outcomes, int128 _amount);

  constructor(address _curr, address _ctf) public {
    currency = _curr;
    CT = _ctf;
  }

  function buySingleEvent(address _event, uint _outcome, int128 _amount) public {
    IERC20(currency).approve(_event,ABDKMath.mulu(_amount,10**18));
    int128 transfer = ISCMMaker(_event).buyshares(msg.sender,_outcome,_amount);
    require(IERC20(currency).transferFrom(msg.sender,address(this),ABDKMath.mulu(transfer,10**18)));
    emit BetCreated(_event, _outcome, _amount);
  }

  function getInversePartition(uint256 index, uint256 len) public pure returns (uint256[] memory) {
    uint256[] memory partx = new uint256[](2);
    partx[0] = index;
    partx[1] = (1<<len)-1-index;
    return partx;
  }

  function buyComboEvent(address[] memory _events, uint[] memory _outcomes, int128 _amount) public {
    require(_events.length == _outcomes.length,'mismatch length');
    int128[] memory prices = new int128[](_events.length);
    int128 price = _amount;
    int128 size = ABDKMath.div(_amount,ABDKMath.fromUInt(_events.length));
    bytes32 prevCollection = bytes32(0);
    for(uint i=0;i<_events.length;i++) {
      prices[i] = ISCMMaker(_events[i]).buyvirtualshares(address(this),_outcomes[i],size);
      price = ABDKMath.mul(price,ABDKMath.div(prices[i],size));
      IERC20(currency).approve(CT,ABDKMath.mulu(_amount,10**18));
      ConditionalTokens(CT).splitPosition(IERC20(currency),prevCollection,ISCMMaker(_events[i]).getCondition(),
        getInversePartition(_outcomes[i],ISCMMaker(_events[i]).getNumberOutcomes()),ABDKMath.mulu(_amount,10**18));
      prevCollection = ConditionalTokens(CT).getCollectionId(prevCollection,ISCMMaker(_events[i]).getCondition(),_outcomes[i]);
    }
    require(IERC20(currency).transferFrom(msg.sender,address(this),ABDKMath.mulu(price,10**18)));
    ConditionalTokens(CT).safeTransferFrom(address(this),msg.sender,ConditionalTokens(CT).getPositionId(IERC20(currency),prevCollection),ABDKMath.mulu(_amount,10**18),'');
    emit ComboBetCreated(_events, _outcomes, _amount);
  }

  function getComboEventPrice(address[] memory _events, uint[] memory _outcomes, int128 _amount) public view returns (int128){
    require(_events.length == _outcomes.length,'mismatch length');
    int128[] memory prices = new int128[](_events.length);
    int128 price = _amount;
    int128 size = ABDKMath.div(_amount,ABDKMath.fromUInt(_events.length));
    for(uint i=0;i<_events.length;i++) {
      prices[i] = ISCMMaker(_events[i]).priceI(_outcomes[i],size);
      price = ABDKMath.mul(price,ABDKMath.div(prices[i],size));
    }
    return price;
  }

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
