pragma solidity ^0.6.0;

import "./interfaces/IArbitrable.sol";
import "./interfaces/IArbitrator.sol";
import "./interfaces/IEvidence.sol";
import { ABDKMath } from "./ABDKMath64x64.sol";

contract SCFactory {

    mapping(uint256 => SCMMaker) public market;
    uint256 public markets;

    event MarketCreated(SCMMaker _market);

    function createMarket(uint8 _numOptions, uint256 endTime, uint256 resultTime, string memory hash) public {
        market[markets] = new SCMMaker(msg.sender, _numOptions,endTime, resultTime, hash);
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

contract SCMMaker is IArbitrable, IEvidence{

    uint8 public numOfOutcomes; //How many different options can you bet on? - note that you cannot bet on option 0, the #INVALID option
    uint8 private outcome;

    mapping(uint8 => int128) private q; //How many outstanding shares for each option?
    mapping(uint8 => mapping(address => int128)) private balances; // How many shares does a user own?

    int128 private b; //The total outstanding balance (equivalent to sum of all q) multiplied by ALPHA
    int128 private alpha; //This is a constant, decided at runtime that determines the sensitivity to liquidity
    int128 private current_cost; //Running total of the cost function, to prevent you from calculating multiple exp
    int128 private total_balance; //sum of all q ()

    uint256 private constant initialLiq = 100; //Need to decide what the minimum liquidity is for a market.. Start with 100 USD

    uint256 public appealTimestamp;
    uint256 public endTimestamp;
    uint256 public resultTimestamp;
    uint256 private dispute_id;

    uint256 private constant DISPUTE_TIME = 1 days;

    address private game_master;
    address private disputer;
    address private currency;
    IArbitrator public kleros = IArbitrator(0xaededC9A349B19508cdAeD4C6F8CF244413260E7);


    enum Status { BettingOpen, NoMoreBets, Appealable, Disputed, Resolved }
    Status public status;
    string private ipfsHash = '';

    /**
     * constructor function
     * param _numOptions: How many different outcomes can you bet on? (please ignore option zero here)
     * alpha is calculated as a constant that is used later on
     * need to add endtime, result time, and ipfs hash
     **/
    constructor(address _owner, uint8 _numOptions, uint256 endTime, uint256 resultTime, string memory hash) public {
        numOfOutcomes = _numOptions;
        int128 IL = ABDKMath.fromUInt(initialLiq);
        int128 n = ABDKMath.fromUInt(_numOptions);
        alpha = ABDKMath.div(1,ABDKMath.mul(10,ABDKMath.mul(n,ABDKMath.ln(n))));
        b = ABDKMath.mul(ABDKMath.mul(IL,n),alpha);
        int128 sumtotal;
        int128 eqb = ABDKMath.exp(ABDKMath.div(IL,b));
        game_master = _owner;
        for(uint8 i=0;i<numOfOutcomes;i++) {
            q[i] = IL;
            //balances[i][msg.sender] = IL;
            sumtotal = ABDKMath.add(sumtotal,eqb);
            total_balance = ABDKMath.add(total_balance,IL);
        }
        current_cost = ABDKMath.mul(b,ABDKMath.ln(sumtotal));
        endTimestamp = endTime;
        resultTimestamp = resultTime;
        emit MetaEvidence(0,hash);
    }//"/ipfs/QmWcHMmZfMWkVHYSNNe6qrAhM5FiWQcjSad3hUseXEjCxA/metaEvidence.json"

    /*
      AMM functions
    */

    function cost() public view returns (int128) {  //Getter function, designed for the frontend
        int128 sumtotal;
        for(uint8 i=0; i<numOfOutcomes;i++) {
            sumtotal = ABDKMath.add(sumtotal,ABDKMath.exp(ABDKMath.div(q[i],b)));
        }
        return ABDKMath.mul(b,ABDKMath.ln(sumtotal));
    }

    function costafterbuy(uint8 _outcome, int128 amount) public view returns (int128) { //Getter function, designed for front end
        int128 sumtotal;
        int128 _b = ABDKMath.mul(ABDKMath.add(total_balance,amount),alpha);
        for(uint8 i=0; i<numOfOutcomes;i++) {
            if(i!=_outcome) {
                sumtotal = ABDKMath.add(sumtotal,
                ABDKMath.exp(
                    ABDKMath.div(q[i],
                _b)
                ));
            } else {
                sumtotal = ABDKMath.add(sumtotal,
                ABDKMath.exp(
                    ABDKMath.div(
                        ABDKMath.add(q[_outcome],amount),
                    _b))

                );
            }
        }
        return ABDKMath.mul(_b,ABDKMath.ln(sumtotal));
    }

    function price(uint8 _outcome, int128 amount) public view returns (uint256) { // Getter function, designed for the frontend
       return ABDKMath.mulu(ABDKMath.sub(costafterbuy(_outcome,amount),cost()),1000000);
    }

    function buyshares(uint8 _outcome, int128 amount) public returns (int128 spot_price) {
        require(status == Status.BettingOpen,'No more bets'); // There should be a check in the front-end to make sure that betting is open (also check endTimestamp), otherwise that would suck for you to spend gas
        require(_outcome > 0, "Can't bet on option 0"); //disable option 0 for now
        require(amount < total_balance,"Buying too many shares!"); //user will never get a good price for this bet, so save on some gas
        if(block.timestamp > endTimestamp) { //If the user tries to place a bet but it's too late, then they can pay the gas to switch state
            status = Status.NoMoreBets;
        } else {
            int128 new_cost;
            int128 sumtotal;
            total_balance = ABDKMath.add(total_balance,amount);
            b = ABDKMath.mul(total_balance,alpha);
            q[_outcome] = ABDKMath.add(q[_outcome],amount);
            balances[_outcome][msg.sender] = ABDKMath.add(balances[_outcome][msg.sender],amount);
            for(uint8 i=0; i<numOfOutcomes;i++) {
                sumtotal = ABDKMath.add(sumtotal,
                ABDKMath.exp(
                    ABDKMath.div(q[i],
                    b)
                ));
            }
            new_cost = ABDKMath.mul(b,ABDKMath.ln(sumtotal));
            spot_price = ABDKMath.sub(new_cost,current_cost);
            //require(currency.transfer(this.address,ABDKMath.toUInt(spot_price*1000000000000000000)));
            current_cost = new_cost;
        }
    }

    function claimReward() public returns (uint256) {
        require(block.timestamp > resultTimestamp,'Too early to claim');
        require(status == Status.Resolved || (
            status == Status.Appealable && block.timestamp > appealTimestamp),'Waiting for appeals');
        int128 reward = balances[outcome][msg.sender];
        q[outcome] = 0;   //TODO: this should be --
        balances[outcome][msg.sender] = 0;
        total_balance = ABDKMath.sub(total_balance,reward);
        uint256 winnings = ABDKMath.mulu(reward,10**18);
        //require(currency.transferFrom(this.address,msg.sender,winnings));
        return(winnings);
    }

    function fu(uint256 x) public pure returns (int128) { //DEBUGGING FUNCTION - for convenience only
        return ABDKMath.fromUInt(x);
    }

    function tu(int128 x) public pure returns (uint256) { //DEBUGGING FUNCTION - for convenience only
        return ABDKMath.mulu(x,1000000);
    }

    function getBalanceOf(uint8 _outcome, address _acc) public view returns (int128) {
        return balances[_outcome][_acc];
    }

    function outstandingShares(uint8 _outcome) public view returns (int128) {
        return q[_outcome];
    }

    function totalShares() public view returns (int128) {
        return total_balance;
    }

    /*
      ORACLE FUNCTIONS
    */

    function setOutcome(uint8 _outcome) public {
        require(status != Status.Disputed,"DECISION GONE TO KLEROS");
        require(msg.sender == game_master,"ONLY MASTER CAN CALL");
        require(block.timestamp > resultTimestamp,'TOO EARLY TO DECIDE OUTCOME');
        require(status == Status.BettingOpen || status == Status.NoMoreBets,"INVALID STATE");
        //With this implementation, the user can still set the outcome after 24h but only if nobody else has disputed
        require(_outcome < numOfOutcomes+1,"INVALID OUTCOME!!");
        outcome = _outcome;
        status = Status.Appealable;
        appealTimestamp = block.timestamp + DISPUTE_TIME;
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

        if(uint8(_ruling) == outcome) { //KLEROS VOTED IN FAVOUR OF THE ILP
            //technically do nothing here
        } else { //KLEROS CHANGED THE INITIAL OUTCOME
            outcome = uint8(_ruling);
            game_master = disputer; //change the game master to the disputer
        }
        status = Status.Resolved;
        emit Ruling(kleros, _disputeID, _ruling);
    }

    function getOutcome() public view returns (uint8) {
        return outcome;
    }
}
