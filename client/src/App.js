import React, {Component} from 'react';
import AppBar from '@material-ui/core/AppBar'
import Typography from '@material-ui/core/Typography'
import Grid from '@material-ui/core/Grid'
import Button from '@material-ui/core/Button'

import CreateMarket from './CreateMarket'
import Bets from './Bets'
import Betslip from './Betslip'

import Web3 from 'web3';
import EventContract from './SCEvent.json'
import ArbitratorContract from './SimpleCentralizedArbitrator.json'
import FactoryContract from './SCFactory.json'
import FakeDai from './contracts/FakeDai.json'

const ipfs = require("nano-ipfs-store").at("https://ipfs.infura.io:5001");

const enc = new TextEncoder()

let depositemitter = ""
let createeventemitter = ""

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
      betslip: []
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

  handleChangePurchaseSize = (e,bet) => {
    if(e.target.value == 0) {
      this.setState({quotedPrice: 0})
    }
    this.state.event[this.state.openBetBet].methods.price(this.state.openBetOption,new this.state.web3.utils.BN(e.target.value).shln(64)).call().then((res) => {
      this.setState({quotedPrice: res/1000000})
    })
    this.setState({quotedAmount: e.target.value})
  }

  async componentDidMount() {
    await this.loadWeb3()
    await this.loadData()
    this.listenForEvents()
  }

  componentWillUnmount() {
    depositemitter.removeAllListeners('data')
    createeventemitter.removeAllListeners('data')
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

  handleCreateMarket = (data,numOptions,endTime,resultTime) => {
    console.log('Attempting to add event: ',numOptions,endTime,resultTime,data)
    ipfs.add(enc.encode(JSON.stringify(data))).then((ipfsHash) => {
      console.log('/ipfs/'+ipfsHash)
      this.state.factory.methods.createMarket(numOptions,endTime,resultTime,'/ipfs/'+ipfsHash).send({from: this.state.account})
      .once('receipt', ((receipt) => {
        try {
          console.log('Market successfully created!!')
        } catch (e) {
          console.log('Error ',e)
        }
      }))
    })

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

  handlePlaceBet = (e) => {
    console.log(`Attempting to buy ${this.state.quotedAmount} shares on option [${this.state.openBetOption}] on event: ${this.state.eventData[this.state.openBetBet].title} at address ${this.state.event[this.state.openBetBet]._address}`)
    try{
      this.state.event[this.state.openBetBet].methods.buyshares(this.state.openBetOption,new this.state.web3.utils.BN(this.state.quotedAmount).shln(64)).send({from: this.state.account})
      .once('receipt', ((receipt) => {
        console.log('Placed Bet!')
        this.setState({openBet: false})
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

  handleRemoveBet = (e) => {
    var obj = [...this.state.betslip]
    if(e !== -1) {
      obj.splice(e,1);
    }
    this.setState({betslip: obj})
  }

  handleOpenBet = (e,b,o) => {
    if(this.state.betslip.map(function(o) {return o.event; }).indexOf(this.state.eventData[b].address) < 0) {
      var obj = {
        event: this.state.eventData[b].address,
        outcome: o
      }
      this.setState({betslip: [...this.state.betslip, obj]})
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

    const factory = new web3.eth.Contract(FactoryContract.abi, '0x31F96B9f6FC7b16F9d82485904B6a50FcFB63225')
    this.setState({factory})

    const currency = new web3.eth.Contract(FakeDai.abi, '0xF87B777E5E7E36E83BFcaBfa1c11547EAb2406f5')
    this.setState({currency})

    const balance = await currency.methods.balanceOf(this.state.account).call()
    this.setState({balance})

    const numEvents = await factory.methods.getNumberOfMarkets().call()
    this.setState({numberOfEvents: numEvents})
    const arbitrator = new web3.eth.Contract(ArbitratorContract.abi,'0xd49FF467D906D120b1DCcA9234eEF5f4CBa4DcA0')
    this.setState({arbitrator})

    const numArbs = await arbitrator.methods.getNumberOfDisputes().call()
    for(var k=0;k<numArbs;k++) {
      var arb_data = await arbitrator.methods.getDisputeData(k).call()
      .then((response) => {
        this.addDisputeData(response)
      })

    }

    for(var i=0;i<numEvents;i++) {
      var addr = await factory.methods.getMarket(i).call()
      var ev = new web3.eth.Contract(EventContract.abi, addr)
      this.setState({event: [...this.state.event,ev]})

      var numOptions = await ev.methods.numOfOutcomes().call()
      var price = []
      var balances = []
      for (var j=0; j<numOptions; j++) {
        price[j] = (await ev.methods.price(j,new web3.utils.BN('18446744073709551616')).call()/1000000).toFixed(2)
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
      price[j] = (await ev.methods.price(j,new this.state.web3.utils.BN('18446744073709551616')).call()/1000000).toFixed(2)
    }

    var outcome = await ev.methods.getOutcome().call()
    var endTime = await ev.methods.endTimestamp().call()
    var resultTime = await ev.methods.resultTimestamp().call()

    var state = await ev.methods.status().call()

    var metaevidence
    await ev.getPastEvents('MetaEvidence', {fromBlock: 0, toBlock: 'latest'})
    .then((evx) => {
      metaevidence = evx[0].returnValues._evidence;
      console.log('Loading file: ',metaevidence)
      var output = fetch('https://gateway.ipfs.io'+metaevidence)
      .then((response) => response.json())
      .then((responseJSON) => {
        this.addEventData(ev._address,responseJSON.title, responseJSON.description, responseJSON.question, responseJSON.rulingOptions.descriptions,endTime,resultTime,outcome,price,balances,state)
        this.setState({numberOfEvents: this.state.numberofEvents+1})
        console.log('Finished loading: ',metaevidence);
      })
    })
  }


  listenForEvents = () => {
    if(this.state.loading == false) {
    depositemitter = this.state.currency.events.Transfer().on('data',(event,error) => {
      if(event.returnValues.to==this.state.account) {
        this.updateBalance()
      }
    })
    createeventemitter = this.state.factory.events.MarketCreated().on('data',(event,error) => {
      this.updateMarkets(event.returnValues._market)
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
        <Betslip handleRemoveBet={this.handleRemoveBet} handleDisputeOutcome={this.handleDisputeOutcome} state={this.state}/>
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
