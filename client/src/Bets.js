import React, {Component} from 'react';
import Accordion from '@material-ui/core/Accordion';
import AccordionSummary from '@material-ui/core/AccordionSummary';
import AccordionDetails from '@material-ui/core/AccordionDetails';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import Container from '@material-ui/core/Container'
import Typography from '@material-ui/core/Typography'
import Button from '@material-ui/core/Button'
import {List, ListItem} from '@material-ui/core'
import CardMedia from '@material-ui/core/CardMedia'
import Dialog from '@material-ui/core/Dialog'
import DialogTitle from '@material-ui/core/DialogTitle'
import TextField from '@material-ui/core/TextField'

const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']

function returnFormattedTime(unix) {
  var date = new Date(unix*1000)
  var day = date.getDate()
  var month = months[date.getMonth()]
  var year = date.getFullYear()
  var hours = date.getHours()
  var mins = (date.getMinutes()<10?'0'+date.getMinutes():date.getMinutes())
  var secs = (date.getSeconds()<10?'0'+date.getSeconds():date.getSeconds())
  return day+" "+month+" "+year+" "+hours+":"+mins+":"+secs
}


class BetCard extends Component {
  constructor(props) {
    super()
    this.state = {
      openBet: true,
      currentBet: 0,
      timestamp: 0
    }
  }

  renderOutcome(resultTime,outcome,options) {
    let timestamp = (Date.now())/1000
    if(timestamp > resultTime) {
      if(outcome == 0) {
        return(<Typography> Waiting for outcome to be set..</Typography>)
      } else {
        return(<Typography> Outcome: {options[(outcome>>1)]} </Typography>)
      }
    } else {
      return ''
    }
  }

  renderBettingTime(endTime) {
    let timestamp = (Date.now())/1000
    if(timestamp > endTime) {
      return(<Typography>Betting finished.</Typography>)
    } else {
      return(<Typography>End of betting: {returnFormattedTime(endTime)}</Typography>)
    }
  }

  renderSetOutcome(account,eventowner,resultTime,outcome,kid) {
    let timestamp = (Date.now())/1000
    if((timestamp > resultTime) && account==eventowner && outcome==0) {
      return(<ListItem button id={kid} label="Set Outcome" onClick={this.handleOpenSetOutcome} >Set outcome</ListItem>)
    } else {
      return ''
    }
  }

  renderDisputeAnswer(resultTime,kid) {
    let timestamp = (Date.now())/1000
    if(timestamp > resultTime) {
      return ''//return(<ListItem button id={kid}>Dispute Answer (Disabled for test)</ListItem>)
    } else {
      return ''
    }
  }

  renderClaimReward(state) {
    if(state == 4) {
      return(<ListItem button>Claim reward</ListItem>)
    } else {
      return ''
    }
  }

  handleDispute = (e) => {
    this.props.handleDispute(e,parseInt(e.target.id))
  }

  handleOpen = (e) => {
    if(((Date.now())/1000) < this.props.state.eventData[this.props.id].endTime) {
      this.props.handleOpen(e,this.props.id,parseInt(e.target.id))
    }
  }

  handleOpenSetOutcome = (e) => {
    this.props.handleOpenSetOutcome(e,e.target.id)
  }

  render() {
    var eventData = this.props.state.eventData[this.props.id]
    return(
      <div>
      <Typography>{eventData.description}</Typography>
      <List>
      {
        eventData.options.map((option,key) => {
          return(
            <ListItem button id={key} onClick={this.handleOpen}>{eventData.options[key]}: {eventData.price[key]} </ListItem>
          )
        })
      }
      </List>
      {this.renderOutcome(eventData.resultTime,eventData.outcome,eventData.options)}
      {this.renderBettingTime(eventData.endTime)}
      <List>
      {this.renderSetOutcome(this.props.state.account,eventData.owner,eventData.resultTime,eventData.outcome,this.props.id)}
      {this.renderDisputeAnswer(eventData.resultTime,this.props.id)}
      {this.renderClaimReward(eventData.state)}
      </List>
    </div>)
  }
}

class Bets extends Component {
  constructor(props) {
    super()
  }

  handleClose = (e) => {
    this.props.handleClose()
  }

  handleSetOutcome = (e) => {
    this.props.handleSetOutcome(e,parseInt(e.target.id))
  }

  handleSubmit = (e) => {
    this.props.handlePlaceBet()
  }

  render() {
    if(this.props.state.eventData.length==0) {
      return(
        <Container>
          <img style={{ width: "100%"}} src="active_markets.png" />
          <CardMedia style={{ height: "200px" }} image="/market2.jpg" />
          <div> No events </div>
        </Container>
      )
    } else {
      return(
        <Container>
        <Dialog open={this.props.openSetOutcome} onClose={this.props.handleCloseSetOutcome} scroll='body'>
        <img style={{ width: "100%"}} src="set_outcome.png" alt= "set outcome"/>
        <Typography>{this.props.state.eventData[this.props.state.openSetOutcomeBet].title}</Typography>
        <Typography>{this.props.state.eventData[this.props.state.openSetOutcomeBet].description}</Typography>
        <List>
        {
          this.props.state.eventData[this.props.state.openSetOutcomeBet].options.map((option,key) => {
            return(
              <ListItem button id={key} onClick={this.handleSetOutcome}>{option}</ListItem>
            )
          })
        }
        </List>
        </Dialog>
        <img style={{ width: "100%"}} src="active_markets.png" />
        <CardMedia style={{ height: "200px" }} image="/market2.jpg" />
        <div>
        {
          this.props.state.eventData.map((bet,key) => {
            return(
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}> {this.props.state.eventData[key].title} </AccordionSummary>
                <AccordionDetails> <BetCard id={key} key={this.props.state.eventData.id} state={this.props.state} handleDispute={this.props.handleDispute} handleOpenSetOutcome={this.props.handleOpenSetOutcome} handleOpen={this.props.handleOpen} /> </AccordionDetails>
              </Accordion>
            )
          })
        }
        </div>
        </Container>
      )
    }
  }
}

export default Bets
