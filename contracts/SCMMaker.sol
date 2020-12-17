pragma solidity ^0.6.0;

import "./interfaces/IArbitrable.sol";
import "./interfaces/IArbitrator.sol";
import "./interfaces/IEvidence.sol";
import "./interfaces/ISCMMaker.sol";
import {ABDKMath} from "./ABDKMath64x64.sol";
import "./ConditionalTokens.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

contract SCFactory {

    mapping(uint256 => SCMMaker) public market;
    uint256 public markets;
    address private currency;
    address private conditionaltokens;

    event MarketCreated(SCMMaker _market);

    constructor(address _curr, address _ctf) public {
      currency = _curr;
      conditionaltokens = _ctf;
    }

    function createMarket(uint _numOptions, uint256 endTime, string memory hash) public {
        market[markets] = new SCMMaker(msg.sender, currency, conditionaltokens, _numOptions,endTime, hash);
        require(IERC20(currency).transferFrom(msg.sender,address(market[markets]),100*10**18));
        emit MarketCreated(market[markets]);
        markets++;
    }

    function getNumberOfMarkets() public view returns (uint256) {
        return markets;
    }

    function getMarket(uint256 _id) public view returns (SCMMaker) {
        return market[_id];
    }

}

contract SCMMaker is IArbitrable, IEvidence, ISCMMaker, IERC1155Receiver{

    uint public numOfOutcomes; //How many different options can you bet on
    uint private outcome; //the resolved outcome

    int128[] private q; //How many outstanding shares for each option?
    mapping(uint => mapping(address => int128)) private balances; // How many shares does a user own?

    int128 private b; //The total outstanding balance (equivalent to sum of all q) multiplied by ALPHA
    int128 private alpha; //This is a constant, decided at runtime that determines the sensitivity to liquidity
    int128 private current_cost; //Running total of the cost function, to prevent you from calculating multiple exp
    int128 private total_balance; //sum of all q ()

    uint256 public appealTimestamp;
    uint256 public endTimestamp;
    uint256 public resultTimestamp;
    uint256 private dispute_id;

    uint256 private constant DISPUTE_TIME = 1 days;

    address private game_master;
    address private disputer;
    address private currency;
    IArbitrator public kleros = IArbitrator(0xaededC9A349B19508cdAeD4C6F8CF244413260E7);
    ConditionalTokens public CT;

    bytes32 private condition;

    enum Status { BettingOpen, NoMoreBets, Appealable, Disputed, Resolved }
    Status public status;
    string private ipfsHash = '';

    /**
     * constructor function
     * param _numOptions: How many different outcomes can you bet on? (please ignore option zero here)
     * alpha is calculated as a constant that is used later on
     * need to add endtime, result time, and ipfs hash
     **/
    constructor(address _owner, address _currency, address _ct, uint _numOptions, uint256 endTime, string memory hash) public {
        numOfOutcomes = _numOptions;
        currency = _currency;
        int128 IL = ABDKMath.fromUInt(100); //this will be dai.balanceOf
        int128 n = ABDKMath.fromUInt(_numOptions);
        alpha = ABDKMath.div(1,ABDKMath.mul(10,ABDKMath.mul(n,ABDKMath.ln(n))));
        b = ABDKMath.mul(ABDKMath.mul(IL,n),alpha);
        int128 sumtotal;
        int128 eqb = ABDKMath.exp(ABDKMath.div(IL,b));
        game_master = _owner;
        for(uint i=0;i<numOfOutcomes;i++) {
            q.push(IL);
            sumtotal = ABDKMath.add(sumtotal,eqb);
            total_balance = ABDKMath.add(total_balance,IL);
        }
        current_cost = ABDKMath.mul(b,ABDKMath.ln(sumtotal));
        endTimestamp = endTime;
        resultTimestamp = endTime;
        emit MetaEvidence(0,hash);
        CT = ConditionalTokens(_ct);
        CT.prepareCondition(address(this),bytes32(uint256(address(this)) << 96),_numOptions);
        condition = CT.getConditionId(address(this),bytes32(uint256(address(this)) << 96),_numOptions);
    }
    //The function is now initialised with liquidity split across all outcomes

    /*
      AMM functions
    */

    function cost() public view returns (int128) {  //Getter function, designed for the frontend
        int128 sumtotal;
        for(uint i=0; i<numOfOutcomes;i++) {
            sumtotal = ABDKMath.add(sumtotal,ABDKMath.exp(ABDKMath.div(q[i],b)));
        }
        return ABDKMath.mul(b,ABDKMath.ln(sumtotal));
    }

    function getCondition() public view override returns (bytes32) {
      return condition;
    }

    function getNumberOutcomes() public view override returns (uint) {
      return numOfOutcomes;
    }

    function costafterbuy(uint _outcome, int128 amount) public view returns (int128) { //Getter function, designed for front end
        int128 sumtotal;
        int128[] memory newq = new int128[](q.length);
        int128 TB = total_balance;
        for(uint j=0;j<numOfOutcomes;j++) {
          newq[j] = q[j];
          if((_outcome & (1<<j)) !=0) {
            newq[j] = ABDKMath.add(newq[j],amount);
            TB = ABDKMath.add(TB,amount);
          }
        }
        int128 _b = ABDKMath.mul(TB,alpha);
        for(uint i=0; i<numOfOutcomes;i++) {
          sumtotal = ABDKMath.add(sumtotal,
            ABDKMath.exp(
              ABDKMath.div(newq[i],
            _b)
          ));
        }
        return ABDKMath.mul(_b,ABDKMath.ln(sumtotal));
    }

    function priceU(uint _outcome, int128 amount) public view override returns (uint256) { // Getter function, designed for the frontend
       return ABDKMath.mulu(ABDKMath.sub(costafterbuy(_outcome,amount),cost()),1000000);
    }
    function priceI(uint _outcome, int128 amount) public view override returns (int128) { // Getter function, designed for the frontend
       return ABDKMath.sub(costafterbuy(_outcome,amount),cost());
    }

    function getIndexSet(uint _set) public pure returns (uint) {
      return 1<<_set;
    }

    function getOwner() public view returns (address) {
      return game_master;
    }

    function getInversePartition(uint256 index, uint256 len) public pure returns (uint256[] memory) {
      uint256[] memory partx = new uint256[](2);
      partx[0] = index;
      partx[1] = (1<<len)-1-index;
      return partx;
    }

    function buyshares(address _user, uint _outcome, int128 amount) public override returns (int128 spot_price) {
        require(status == Status.BettingOpen,'No more bets'); // There should be a check in the front-end to make sure that betting is open (also check endTimestamp), otherwise that would suck for you to spend gas
        require(amount < total_balance,"Buying too many shares!"); //user will never get a good price for this bet, so save on some gas
        if(block.timestamp > endTimestamp) { //If the user tries to place a bet but it's too late, then they can pay the gas to switch state
            status = Status.NoMoreBets;
        } else {
            int128 new_cost;
            int128 sumtotal;
            for(uint j=0;j<numOfOutcomes;j++) {
              if((_outcome & (1<<j)) !=0) {
                q[j] = ABDKMath.add(q[j],amount);
                total_balance = ABDKMath.add(total_balance,amount);
              }
            }
            b = ABDKMath.mul(total_balance,alpha);
            for(uint i=0; i<numOfOutcomes;i++) {
              sumtotal = ABDKMath.add(sumtotal,
                ABDKMath.exp(
                  ABDKMath.div(q[i],
                b)
              ));
            }
            new_cost = ABDKMath.mul(b,ABDKMath.ln(sumtotal));
            spot_price = ABDKMath.sub(new_cost,current_cost);
            uint uprice = ABDKMath.mulu(spot_price,10**18);
            uint uamount = ABDKMath.mulu(amount,10**18);
            require(IERC20(currency).transferFrom(msg.sender,address(this),uprice));
            IERC20(currency).approve(address(CT),uamount);
            CT.splitPosition(IERC20(currency),bytes32(0),condition,getInversePartition(_outcome,numOfOutcomes),uamount);
            uint pos = CT.getPositionId(IERC20(currency),CT.getCollectionId(bytes32(0),condition,_outcome));
            CT.safeTransferFrom(address(this),_user,pos,uamount,'');
            current_cost = new_cost;
        }
    }

    function buyvirtualshares(address _user, uint _outcome, int128 amount) public override returns (int128 spot_price) {
      require(status == Status.BettingOpen,'No more bets'); // There should be a check in the front-end to make sure that betting is open (also check endTimestamp), otherwise that would suck for you to spend gas
      require(amount < total_balance,"Buying too many shares!"); //user will never get a good price for this bet, so save on some gas
      if(block.timestamp > endTimestamp) { //If the user tries to place a bet but it's too late, then they can pay the gas to switch state
          status = Status.NoMoreBets;
      } else {
          int128 new_cost;
          int128 sumtotal;
          for(uint j=0;j<numOfOutcomes;j++) {
            if((_outcome & (1<<j)) !=0) {
              q[j] = ABDKMath.add(q[j],amount);
              total_balance = ABDKMath.add(total_balance,amount);
            }
          }
          b = ABDKMath.mul(total_balance,alpha);
          for(uint i=0; i<numOfOutcomes;i++) {
            sumtotal = ABDKMath.add(sumtotal,
              ABDKMath.exp(
                ABDKMath.div(q[i],
              b)
            ));
          }
          new_cost = ABDKMath.mul(b,ABDKMath.ln(sumtotal));
          spot_price = ABDKMath.sub(new_cost,current_cost);
          current_cost = new_cost;
      }
    }

    /*
      ORACLE FUNCTIONS
    */

    function getPayoutMatrix(uint _outcomes, uint _n) private pure returns (uint[] memory) {
        uint[] memory matrix = new uint[](_n);
        for(uint i=0;i<_n;i++) {
          if((_outcomes & 1<<i) != 0) {
            matrix[i] = 1;
          }
        }
        return matrix;
    }

    function setOutcome(uint _outcome) public {
        require(status != Status.Disputed,"DECISION GONE TO KLEROS");
        require(msg.sender == game_master,"ONLY MASTER CAN CALL");
        require(block.timestamp > resultTimestamp,'TOO EARLY TO DECIDE OUTCOME');
        require(status == Status.BettingOpen || status == Status.NoMoreBets,"INVALID STATE");
        //With this implementation, the user can still set the outcome after 24h but only if nobody else has disputed
        //require(_outcome < numOfOutcomes+1,"INVALID OUTCOME!!");
        outcome = _outcome;
        status = Status.Appealable;
        appealTimestamp = block.timestamp + DISPUTE_TIME;
        ConditionalTokens(CT).reportPayouts(bytes32(uint256(address(this)) << 96),getPayoutMatrix(_outcome,numOfOutcomes));
    }

    function disputeOutcome() public payable {
        require(status != Status.Disputed,"Already disputed");
        require ( (status == Status.Appealable && block.timestamp < appealTimestamp) ||
        (status == Status.NoMoreBets && block.timestamp < (resultTimestamp+DISPUTE_TIME)) ||
        (status == Status.BettingOpen && block.timestamp > endTimestamp && block.timestamp>(resultTimestamp+DISPUTE_TIME)),
        "CAN'T DISPUTE");
        disputer = msg.sender;
        status = Status.Disputed;
        //GO TO KLEROS, DO NOT PASS GO
        uint arb_cost = kleros.arbitrationCost('');
        require(msg.value >= arb_cost);
        dispute_id = kleros.createDispute{value: arb_cost}(numOfOutcomes,'');
        emit Dispute(kleros, dispute_id, 0, 0);
    }

    function rule(uint _disputeID, uint _ruling) external override {
        require (msg.sender == address(kleros),"JUSE USE KLEROS");
        require (_disputeID == dispute_id,"WRONG DISPUTE");

        if(uint(_ruling) == outcome) { //KLEROS VOTED IN FAVOUR OF THE ILP
            //technically do nothing here
        } else { //KLEROS CHANGED THE INITIAL OUTCOME
            outcome = uint(_ruling);
            game_master = disputer; //change the game master to the disputer
        }
        status = Status.Resolved;
        emit Ruling(kleros, _disputeID, _ruling);
    }

    function getOutcome() public view returns (uint) {
        return outcome;
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
