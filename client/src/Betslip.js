import React, {Component} from 'react';
import Accordion from '@material-ui/core/Accordion';
import AccordionSummary from '@material-ui/core/AccordionSummary';
import AccordionDetails from '@material-ui/core/AccordionDetails';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import Container from '@material-ui/core/Container'
import Typography from '@material-ui/core/Typography'
import Button from '@material-ui/core/Button';
import ButtonGroup from '@material-ui/core/ButtonGroup';
import {List, ListItem,CardMedia} from '@material-ui/core'
import {PropTypes} from 'react'
import CancelIcon from '@material-ui/icons/Cancel';
import IconButton from '@material-ui/core/IconButton';
import TextField from '@material-ui/core/TextField'

var BN = require('ethers').BigNumber

let audio = new Audio("combobreaker.mp3")

const start = () => {
  audio.play()
}

const haha = 'HAHA'

class BetPositions extends Component {
  constructor(props) {
    super()
  }

  handleSingleClaim = (events,outcome) => {
    this.props.handleSingleClaim(events,outcome)
  }

  handleComboClaim = (events,outcomes) => {
    this.props.handleComboClaim(events,outcomes)
  }
  //function redeemPositions(IERC20 collateralToken, bytes32 parentCollectionId, bytes32 conditionId, uint[] calldata indexSets) external {

  parseOutcome(options,outcome) {
    var num = options.length
    var output = ""
    for(var i=0;i<num;i++) {
      if((outcome & (1<<i)) == 0 ) {
        continue
      } else {
        if(output=="") {
          output = options[i]
        } else {
          output = output + "|" + options[i]
        }
      }
    }
    return output
  }

  parseRedeemButtonSingle(outcome,position,events) {
    if(outcome == 0) {
      return (<Button>🟡 pending</Button>)
    } else {
      if(outcome == position) {
        return (<Button onClick={() => this.handleSingleClaim(events,position)}>🟢 Claim</Button>)
      } else {
        return (<Button>🔴 Lost bet</Button>)
      }
    }
  }

  parseRedeemButtonCombo(eventData,comboPositions, betid) {
    var output = 1;
    var i = comboPositions.map(function(o) {return BN.from(o.position).toHexString();}).indexOf(BN.from(betid).toHexString())
    var comboBet = comboPositions[i]

    var outputArray = []

    comboBet.addresses.map((events,keys) => {
      var j = eventData.map(function(o) {return o.address;}).indexOf(events)
      if(eventData[j].outcome == 0) {
        outputArray.push(0)
      } else if(comboBet.outcomes[keys] & (1<<eventData[j].outcome) != 0) {
        outputArray.push(1)
      } else {
        outputArray.push(-1)
      }

    })

    outputArray.map((op) => {
      if(op == -1 ) {
        output = -1
      } else if(op == 0 && output>= 0) {
        output = 0
      }
    })

    console.log(comboBet)

    if(output == 0) {
      return (<Button>🟡 pending</Button>)
    } else if (output == 1) {
      return(<Button onClick={() => this.handleComboClaim(comboBet.addresses,comboBet.outcomes)} >🟢 Claim</Button>)
    } else if (output == -1) {
      return (<Button>🔴 {"C-".repeat(outputArray.length-1)}COMBO BREAKER</Button>)
    }
  }

  tryParseComboBet(state, id, amount) {
    var output = ""
    var eventarray = []
    var outcomearray = []
    state.comboPositions.map((comboPositions,koComboPositions) => {
      if(BN.from(id).eq(BN.from(comboPositions.position))) {
        eventarray = comboPositions.addresses
        outcomearray = comboPositions.outcomes
      }
    })
    eventarray.map((event,koEvent) => {
      var index = state.eventData.map(function(o) {return o.address;}).indexOf(event)
      output += state.eventData[index].title.toUpperCase()+"("+this.parseOutcome(state.eventData[index].options,outcomearray[koEvent])+") "
    })
    return (
        `$${amount}: ${output}`
      )
  }

  render() {
    return(
      <div>
        Your Active Positions:
        {this.props.state.positions.map((bet,key) => {
          var betevent = -1
          var betoutcome = -1
          this.props.state.singlePositionId.map((positions,a) => {
            positions.positions.map((position,b) => {
              if(position.position == bet.id) {
                betevent = positions.address
                betoutcome = position.outcome
              }
            })
          })
          if(betevent!=-1) {
            var i =this.props.state.eventData.map(function(o) {return o.address;}).indexOf(betevent)
            var title = this.props.state.eventData[i].title
            var outcome = this.parseOutcome(this.props.state.eventData[i].options,betoutcome)
            return(
              <div>
              ${bet.amount}: {title}({outcome}) {this.parseRedeemButtonSingle(this.props.state.eventData[i].outcome,betoutcome,this.props.state.eventData[i].address)}
              </div>
            )
          } else if(this.props.state.comboPositions.map(function(o) {return BN.from(o.position).toHexString();}).indexOf(BN.from(bet.id).toHexString()) >= 0) {
            {return(
              <div>
              {this.tryParseComboBet(this.props.state, bet.id, bet.amount)}
              {this.parseRedeemButtonCombo(this.props.state.eventData,this.props.state.comboPositions, bet.id)}
              </div>
            )}
          }
        })}
      </div>
    )
  }
}

class Betslip extends Component {
  constructor(props) {
    super()
  }

  handleRemoveBet = (e) => {
    if(e.target.id == "") {} else {
      this.props.handleRemoveBet(e.target.id)
    }
  }

  containedIfIndex = (a,k,b) => {
    if((a & (1<<k)) == 0) {
      return "outlined"
    } else {
      return "contained"
    }
  }

  alterBet = (e,k,key) => {
    this.props.alterBet(key,k)
  }

  render() {
    if(this.props.state.betslip.length==0) {
      return(
        <Container>
        <img style={{ width: "100%"}} src="cb2.png" />
          <BetPositions handleComboClaim={this.props.handleComboClaim} handleSingleClaim={this.props.handleSingleClaim}  state={this.props.state} />
        </Container>
      )
    } else if(this.props.state.betslip.length==1) {
      return(
        <Container>
        <img style={{ width: "100%"}} src="cb2.png" />
        <div>
          <BetPositions handleComboClaim={this.props.handleComboClaim} handleSingleClaim={this.props.handleSingleClaim} state={this.props.state} />
        <List>
        {this.props.state.betslip.map((bet, key)=> {
          return(
            <ListItem>
              <Container>
              <IconButton color="primary" aria-label="upload picture" component="span" id={key} onClick={this.handleRemoveBet}>
                <CancelIcon style = {{color: "#ED1C24"}} id={key}/>
              </IconButton>
              {this.props.state.eventData[this.props.state.eventData.map(function(o) {return o.address;}).indexOf(bet.event)].title}
              <div>
                <ButtonGroup color="primary">
                {this.props.state.eventData[this.props.state.eventData.map(function(o) {return o.address;}).indexOf(bet.event)].price.map((p,k) => {
                  return(
                    <Button onClick={e => this.alterBet(e,k,key)}
                    variant={this.containedIfIndex(bet.outcome,k,this.props.state.eventData[this.props.state.eventData.map(function(o) {return o.address;}).indexOf(bet.event)].price.length)}> {this.props.state.eventData[this.props.state.eventData.map(function(o) {return o.address;}).indexOf(bet.event)].options[k]}:${p} </Button>
                  )
                })}
                </ButtonGroup>
              </div>
              </Container>
            </ListItem>
          )
        })}
        </List>
        </div>
        <div>
          <TextField label="Outcome tokens to buy" fullWidth value={this.props.state.quotedAmount} onChange={this.props.handleChangePurchaseSingleSize}></TextField>
          <TextField label="Price" fullWidth value={this.props.state.quotedPrice}></TextField>
          <Button colour="primary" onClick={
            () => {
          start();
          this.handleSingleSubmit();
        }
            } type="submit" size="large" style = {{backgroundColor: "#ED1C24", color : "#FFFFFF"}}  variant="contained" component="span" > Submit single bet </Button>
        </div>

        </Container>
      )
    } else {
      return(
        <Container>
        <img style={{ width: "100%"}} src="cb2.png" />
        <div>
          <BetPositions handleComboClaim={this.props.handleComboClaim} handleSingleClaim={this.props.handleSingleClaim} state={this.props.state}/>
        <List>
        {this.props.state.betslip.map((bet, key)=> {
          return(
            <ListItem>
              <Container>
              <IconButton color="primary" style={{"border-color": "#ED1C24"}} component="span" id={key} onClick={this.handleRemoveBet}>
                <CancelIcon id={key}/>
              </IconButton>
              {this.props.state.eventData[this.props.state.eventData.map(function(o) {return o.address;}).indexOf(bet.event)].title}
              <div>
                <ButtonGroup color="primary" >
                {this.props.state.eventData[this.props.state.eventData.map(function(o) {return o.address;}).indexOf(bet.event)].price.map((p,k) => {
                  return(
                    <Button onClick={e => this.alterBet(e,k,key)}
                    variant={this.containedIfIndex(bet.outcome,k,this.props.state.eventData[this.props.state.eventData.map(function(o) {return o.address;}).indexOf(bet.event)].price.length)}> {this.props.state.eventData[this.props.state.eventData.map(function(o) {return o.address;}).indexOf(bet.event)].options[k]}:${p} </Button>
                  )
                })}
                </ButtonGroup>
              </div>
              </Container>
            </ListItem>
          )
        })}
        </List>
        </div>
        <div>
          <TextField label="Outcome tokens to buy" fullWidth onChange={this.props.handleChangePurchaseComboSize} value={this.props.state.quotedAmount}></TextField>
          <TextField label="Price" fullWidth value={this.props.state.quotedPrice}></TextField>
          <Button onClick = {this.props.handleComboSubmit} colour="primary" type="submit" size="large" style = {{backgroundColor: "#ED1C24", color : "#FFFFFF"}}  variant="contained" component="span" > Submit {"C-".repeat(this.props.state.betslip.length-1)}COMBO bet </Button>
        </div>
        </Container>
      )
    }
  }
}

export default Betslip
