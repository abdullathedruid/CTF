import React, {Component} from 'react';
import AppBar from '@material-ui/core/AppBar'
import Typography from '@material-ui/core/Typography'
import Grid from '@material-ui/core/Grid'
import Button from '@material-ui/core/Button'

import CreateMarket from './CreateMarket'
import Bets from './Bets'
import Betslip from './Betslip'

import Web3 from 'web3';
import EventContract from './contracts/SCMMaker.json'
import ArbitratorContract from './contracts/SimpleCentralizedArbitrator.json'
import FactoryContract from './contracts/SCFactory.json'
import FakeDai from './contracts/FakeDai.json'
import Router from './contracts/Router.json'
import ConditionalTokens from './contracts/ConditionalTokens.json'

const ipfs = require("nano-ipfs-store").at("https://ipfs.infura.io:5001");

const enc = new TextEncoder()

let depositemitter = ""
let createeventemitter = ""
let createbetemitter = ""

class App extends Component {

  constructor() {
    super();
    this.state ={
      account: '',
      event: [],
      arbitrator: null,
      factory: null,
      price: 0,
      matchdata: [],
      endTime: 0,
      resultTime: 0,
      loading: true,
      eventData: [],
      disputeData: [],
      numberOfEvents: 0,
      quotedPrice: 0,
      quotedAmount: 0,
      openSetOutcome: false,
      openSetOutcomeBet: 0,
      web3: null,
      balance: 0,
      betslip: [],
      router: null,
      ct: null,
      positions: []
    }
    this.addEventData = this.addEventData.bind(this)
  }

  handleCloseBet = (e) => {
    this.setState({openBet: false})
    this.setState({openBetBet: 0})
    this.setState({openBetOption: 1})
  }

  handleCloseSetOutcome = (e) => {
    this.setState({openSetOutcome: false})
  }

  handleOpenSetOutcome = (e,b) => {
    this.setState({openSetOutcome: true})
    this.setState({openSetOutcomeBet: b})
  }

  async componentDidMount() {
    await this.loadWeb3()
    await this.loadData()
    this.listenForEvents()
  }

  componentWillUnmount() {
    depositemitter.removeAllListeners('data')
    createeventemitter.removeAllListeners('data')
    createbetemitter.removeAllListeners('data')
  }

  async loadWeb3() {
    if(window.ethereum) {
      window.web3 = new Web3(window.ethereum)
      await window.ethereum.enable()
    } else if (window.web3) {
      window.web3 = new Web3(window.web3.currentProvider)
    } else {
      window.alert('Non-ethereum browser detected. Download metamask!')
    }
  }

  handleCreateMarket = (data,numOptions,endTime) => {
    try{
    console.log('Attempting to add event: ',numOptions,endTime,data)
    ipfs.add(enc.encode(JSON.stringify(data))).then((ipfsHash) => {
      console.log('/ipfs/'+ipfsHash)
      this.state.factory.methods.createMarket(numOptions,endTime,'/ipfs/'+ipfsHash).send({from: this.state.account})
      .once('receipt', ((receipt) => {
        try {
          console.log('Market successfully created!!')
        } catch (e) {
          console.log('Error ',e)
        }
      }))
    })
}catch(e) {
  console.log('Error',e)
}
  }

  handleSetOutcome = (e,x) => {
    console.log(`Attempting to set outcome [${x}] for event [${this.state.openSetOutcomeBet}]`)
    try{
      this.state.event[this.state.openSetOutcomeBet].methods.setOutcome(x).send({from: this.state.account})
      .once('receipt', ((receipt) => {
        console.log('Outcome has been set')
        this.setState({openSetOutcome: false})
      }))
    } catch (err) {
      console.log('Error', err)
    }
  }

  handleDispute = (e,b) => {
    try{
      this.state.event[b].methods.disputeOutcome().send({from: this.state.account, value: 1000000000000000})
      .once('receipt', ((receipt) => {
        console.log('Dispute sent to KLEROS')
        this.setState({openBet: false})
      }))
    } catch (err) {
      console.log('Error', err)
    }
  }

  handleDisputeOutcome = (e,b,o) => {
    try{
      this.state.arbitrator.methods.rule(b,o).send({from: this.state.account})
      .once('receipt', ((receipt) => {
        console.log('KLEROS has made the judgement')
      }))
    } catch (err) {
      console.log('Error', err)
    }
  }

  handleMint = (e) => {
    try{
      this.state.currency.methods.mint(this.state.account,this.state.web3.utils.toWei('100')).send({from: this.state.account})
      .once('receipt', ((receipt) => {
        console.log('100 USD minted')
      }))
    } catch (err) {
      console.log('Error', err)
    }
  }

  handleApprove = (e) => {
    try{
      this.state.currency.methods.approve(this.state.router._address,this.state.web3.utils.toWei('100')).send({from: this.state.account})
      .once('receipt', ((receipt) => {
        console.log('100 USD allowance')
      }))
    } catch (err) {
      console.log('Error', err)
    }
    try{
      this.state.currency.methods.approve(this.state.factory._address,this.state.web3.utils.toWei('100')).send({from: this.state.account})
      .once('receipt', ((receipt) => {
        console.log('100 USD allowance')
      }))
    } catch (err) {
      console.log('Error', err)
    }
  }

  handleRemoveBet = (e) => {
    var obj = [...this.state.betslip]
    if(e !== -1) {
      obj.splice(e,1);
    }
    this.setState({betslip: obj})
  }

  handleOpenBet = (e,b,o) => {
    var i = this.state.betslip.map(function(o) {return o.event; }).indexOf(this.state.eventData[b].address)
    if(i < 0) {
      var obj = {
        event: this.state.eventData[b].address,
        outcome: 2**(o)
      }
      this.setState({betslip: [...this.state.betslip, obj]})
    } else {
      var newobj = this.state.betslip
      newobj[i].outcome = 2**o
      this.setState({betslip: newobj})
    }
    this.setState({quotedAmount: 0})
    this.setState({quotedPrice: 0})
  }

  handleChangePurchaseSingleSize = (e) => {
  this.setState({quotedAmount: e.target.value})
  if(e.target.value == 0) {
    this.setState({quotedPrice: 0})
  }
  var evid=0
  this.state.eventData.map((ev,key) => {
    if (ev.address == this.state.betslip[0].event) {
      evid= key
    }})
  this.state.event[evid].methods.price(this.state.betslip[0].outcome,new this.state.web3.utils.BN(e.target.value).shln(64)).call().then((res) => {
    this.setState({quotedPrice: (res/1000000).toFixed(2)})
  })
}

  handleChangePurchaseComboSize = async (e) => {
    this.setState({quotedAmount: e.target.value})
    if(e.target.value == 0) {
      this.setState({quotedPrice: 0})
    }
    var evid=0
    var price = e.target.value
    var po=0;
    this.state.betslip.map(async (bet,key) => {
      this.state.eventData.map((ev,ke) => {
        if(ev.address == bet.event) {
          evid = ke
        }
      })
      var size = e.target.value/this.state.betslip.length
      po = await this.state.event[evid].methods.price(this.state.betslip[key].outcome,new this.state.web3.utils.BN(size).shln(64)).call()
      price *= po/1000000/size
      this.setState({quotedPrice: price.toFixed(2)})
    })
  }

  alterBet = (key,val) => {
    var newobj = this.state.betslip
    if((newobj[key].outcome & (1<<val)) == 0) {
      newobj[key].outcome += 2**val
    } else {
      newobj[key].outcome -= 2**val
    }
    this.setState({betslip: newobj})
    this.setState({quotedAmount: 0})
    this.setState({quotedPrice: 0})
  }

  handleSingleSubmit = (e) => {
    var ev=-1
    this.state.eventData.map((even,key) => {
      if(even.address == this.state.betslip[0].event) {
        ev = key
      }
    })
    if(ev<0) {
      console.log('error finding event')
    } else{
      console.log(`Attempting to buy ${this.state.quotedAmount} shares on option [${this.state.betslip[0].outcome}] on event: ${ev} at address ${this.state.betslip[0].event}`)
    }
    try{
          this.state.router.methods.buySingleEvent(this.state.betslip[0].event,this.state.betslip[0].outcome,new this.state.web3.utils.BN(this.state.quotedAmount).shln(64)).send({from: this.state.account})
          .once('receipt', ((receipt) => {
            console.log('Placed Bet!')
            this.setState({openBet: false})
          }))
        } catch (err) {
          console.log('Error', err)
        }
  }

  addEventData (address,title,description,question,options,endTime,resultTime, outcome, price, balances, state) {
    var obj = {
      address: address,
      title: title,
      description: description,
      question: question,
      options: options,
      endTime: endTime,
      resultTime: resultTime,
      outcome: outcome,
      price: price,
      balances: balances,
      state: state
    }
    this.setState({eventData: [...this.state.eventData, obj]})
  }

  getEventData(address) {
    this.state.eventData.map((ev,key) => {
      if(ev.address == address) {
        return 'test'
      } else {
      }
    })
  }

  addDisputeData(data) {
    var obj = {
      arbitrated: data[0],
      choices: data[1],
      ruling: data[2],
      status: data[3],
      eventData: null
    }
    this.setState({disputeData: [...this.state.disputeData, Object.keys(obj).map((key) => obj[key])]})
  }

  async loadData() {
    const web3 = window.web3
    const accounts = await web3.eth.getAccounts()
    this.setState({account: accounts[0]})

    this.setState({web3})

    const factory = new web3.eth.Contract(FactoryContract.abi, '0x2E1b6561494736Af332b807a94355965408BE382')
    this.setState({factory})

    const currency = new web3.eth.Contract(FakeDai.abi, '0x71D1f893147646cE925CAeD841CB25f8e94249dD')
    this.setState({currency})

    const balance = await currency.methods.balanceOf(this.state.account).call()
    this.setState({balance})

    const numEvents = await factory.methods.getNumberOfMarkets().call()
    this.setState({numberOfEvents: numEvents})

    const router = new web3.eth.Contract(Router.abi, '0x4978B9D7db08415ea4296689624b19DF720fCa79')
    this.setState({router})

    /*const arbitrator = new web3.eth.Contract(ArbitratorContract.abi,'0x91F95Fb01487490245502f0DA6CFaaAd0032B7dc')
    this.setState({arbitrator})

    const numArbs = await arbitrator.methods.getNumberOfDisputes().call()
    for(var k=0;k<numArbs;k++) {
      var arb_data = await arbitrator.methods.getDisputeData(k).call()
      .then((response) => {
        this.addDisputeData(response)
      })

    }*/

    const ct = new web3.eth.Contract(ConditionalTokens.abi,'0x81b20eF8b6B7D7D789A75dDA9a50e538553A75Da')
    this.setState({ct})

    let tokens = await ct.getPastEvents('TransferSingle', {fromBlock: 0, toBlock: 'latest'})
    tokens.map(async (ev,ke) => {
      if(ev.returnValues.to == this.state.account) {
        var i = this.state.positions.map(function(o) {return o.id;}).indexOf(ev.returnValues.id)
        if(i < 0) {
          var obj = {
            id: ev.returnValues.id,
            amount: ev.returnValues.amount//await ct.methods.balanceOf(this.state.account,ev.returnValues.id).call()
          }
          this.setState({positions: [...this.state.positions, obj]})
        }
      }
    })

    for(var i=0;i<numEvents;i++) {
      var addr = await factory.methods.getMarket(i).call()
      var ev = new web3.eth.Contract(EventContract.abi, addr)
      this.setState({event: [...this.state.event,ev]})

      var numOptions = await ev.methods.numOfOutcomes().call()
      var price = []
      var balances = []
      for (var j=0; j<numOptions; j++) {
        price[j] = (await ev.methods.price(2**j,new web3.utils.BN('18446744073709551616')).call()/1000000).toFixed(2)
      }

      var outcome = await ev.methods.getOutcome().call()
      var endTime = await ev.methods.endTimestamp().call()
      var resultTime = await ev.methods.resultTimestamp().call()

      var state = await ev.methods.status().call()


      let output = await ev.getPastEvents('MetaEvidence', {fromBlock: 0, toBlock: 'latest'})
      var metaevidence = output[0].returnValues._evidence;

      //console.log('Loading file: ',metaevidence)
      let ipfs = await fetch('https://gateway.ipfs.io'+metaevidence)
      var responseJSON = await ipfs.json()
      this.addEventData(addr,responseJSON.title, responseJSON.description, responseJSON.question, responseJSON.rulingOptions.descriptions,endTime,resultTime,outcome,price,balances,state)
      //console.log('Finished loading: ',metaevidence);
      if(i>=(numEvents-1)) {
        //console.log('loaded all data')
        this.setState({loading: false})
      }
    }

    if(numEvents==0) {
      this.setState({loading: false})
    }
  }

  async updateBalance() {
    const balance = await this.state.currency.methods.balanceOf(this.state.account).call()
    this.setState({balance})
  }

  async updateMarkets(addr) {
    var ev = new this.state.web3.eth.Contract(EventContract.abi, addr)
    this.setState({event: [...this.state.event,ev]})

    var numOptions = await ev.methods.numOfOutcomes().call()
    var price = []
    var balances = []
    for (var j=0; j<numOptions; j++) {
      price[j] = (await ev.methods.price(2**j,new this.state.web3.utils.BN('18446744073709551616')).call()/1000000).toFixed(2)
    }

    var outcome = await ev.methods.getOutcome().call()
    var endTime = await ev.methods.endTimestamp().call()
    var resultTime = await ev.methods.resultTimestamp().call()

    var state = await ev.methods.status().call()
    let output = await ev.getPastEvents('MetaEvidence', {fromBlock: 0, toBlock: 'latest'})
    var metaevidence = output[0].returnValues._evidence;

    let ipfs = await fetch('https://gateway.ipfs.io'+metaevidence)
    var responseJSON = await ipfs.json()
    this.addEventData(addr,responseJSON.title, responseJSON.description, responseJSON.question, responseJSON.rulingOptions.descriptions,endTime,resultTime,outcome,price,balances,state)
  }

  async updatePrices(addr) {
    var ev = new this.state.web3.eth.Contract(EventContract.abi, addr)
    var numOptions = await ev.methods.numOfOutcomes().call()
    var price = []
    for (var j=0; j<numOptions; j++) {
      price[j] = (await ev.methods.price(2**j,new this.state.web3.utils.BN('18446744073709551616')).call()/1000000).toFixed(2)
    }
    var index = this.state.eventData.map(function(o) {return o.address;}).indexOf(addr)
    if(index>=0) {
      let clone = [...this.state.eventData]
      clone[index].price = price
      this.setState({eventData: clone})
    }
  }

  listenForEvents = () => {
    if(this.state.loading == false) {
    depositemitter = this.state.currency.events.Transfer().on('data',(event,error) => {
      if((event.returnValues.to==this.state.account) || (event.returnValues.from==this.state.account)) {
        this.updateBalance()
      }
    })
    createeventemitter = this.state.factory.events.MarketCreated().on('data',(event,error) => {
      this.updateMarkets(event.returnValues._market)
    })
    createbetemitter = this.state.router.events.BetCreated().on('data',(event,error) => {
      this.updatePrices(event.returnValues._event);
      //console.log(event.returnValues)
    })
  }
    //contract.DisputeCreate({}).on('data', (event,error) => {})*/
  }

  render() {
    if(this.state.loading == false ){
    return(
      <React.Fragment>
      <header>
        <AppBar position="static" style = {{backgroundColor: "#ED1C24"}} >
          <img style={{ width: "50%" }} src="supreme_header.png" />
          <Typography variant="h6" color="inherit" noWrap>
            Your address: {this.state.account}
          </Typography>
          <div>
          <Typography variant="h6" color="inherit" noWrap>
            Your balance: ${Number.parseFloat(this.state.web3.utils.fromWei(this.state.balance)).toFixed(2)}
          </Typography>
          <Button colour="primary" type="submit" size="large" style = {{backgroundColor: "#FFFFFF", color : "#ED1C24"}}  variant="contained" component="span" onClick={this.handleMint}> Give me $100! </Button>
          <Button colour="primary" type="submit" size="large" style = {{backgroundColor: "#FFFFFF", color : "#ED1C24"}}  variant="contained" component="span" onClick={this.handleApprove}> Approve All </Button>
          </div>
        </AppBar>
      </header>
    <main>
    <br/>
    <Grid container spacing = {3}>

      <Grid item xs={4}>
        <CreateMarket createMarket={this.handleCreateMarket} state={this.state}/>
      </Grid>
      <Grid item xs={4}>
        <Bets handleDispute={this.handleDispute} handleSetOutcome = {this.handleSetOutcome} handleOpenSetOutcome={this.handleOpenSetOutcome} handleCloseSetOutcome={this.handleCloseSetOutcome} handlePlaceBet={this.handlePlaceBet} handleChangePurchaseSize={this.handleChangePurchaseSize} state={this.state} openSetOutcome={this.state.openSetOutcome} open={this.state.openBet} handleClose={this.handleCloseBet} handleOpen={this.handleOpenBet}/>
      </Grid>
      <Grid item xs={4}>
        <Betslip handleSingleSubmit={this.handleSingleSubmit} handleChangePurchaseSingleSize={this.handleChangePurchaseSingleSize} handleChangePurchaseComboSize={this.handleChangePurchaseComboSize} alterBet={this.alterBet} handleRemoveBet={this.handleRemoveBet} handleDisputeOutcome={this.handleDisputeOutcome} state={this.state}/>
      </Grid>
    </Grid>
    </main>
    </React.Fragment>
  )} else {
    return(
    <div>
    loading
    </div>
    )
    }
  }
}

export default App;
