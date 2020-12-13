import React, {Component} from 'react';
import Accordion from '@material-ui/core/Accordion';
import AccordionSummary from '@material-ui/core/AccordionSummary';
import AccordionDetails from '@material-ui/core/AccordionDetails';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import Container from '@material-ui/core/Container'
import Typography from '@material-ui/core/Typography'
import Button from '@material-ui/core/Button'
import {List, ListItem,CardMedia} from '@material-ui/core'
import {PropTypes} from 'react'

class DisputeCard extends Component {
  constructor(props) {
    super()
  }

  handleDisputeOutcome = (e) => {
    this.props.handleDisputeOutcome(e,this.props.id,e.target.id) //dispute ID then outcome
  }

  render() {
    var disputeData = this.props.state.disputeData[this.props.id]
    var eventData = []
    this.props.state.eventData.map((ev,id) => {
      if(ev.address == disputeData[0]) {
        eventData = ev
      } else {
      }
    })
    return(
      <div>
      <Typography>{eventData.title}</Typography>
      <Typography>{eventData.description}</Typography>
      <Typography> User claimed the outcome is [{eventData.options[eventData.outcome-1]}] whilst this has been disputed</Typography>
      <Typography>{eventData.question}</Typography>
      <List>
      {eventData.options.map((description,key) => {
        return(
        <ListItem button onClick={this.handleDisputeOutcome} id={(key+1)}>{description}</ListItem>
      )
      })}
      <ListItem button onClick={this.handleDisputeOutcome} id={0}>Refuse to Arbitrate</ListItem>
      </List>
      </div>
    )
  }
}

const disputes = []

class Betslip extends Component {
  constructor(props) {
    super()
  }

  render() {
    return(
      <Container>
      <img style={{ width: "100%"}} src="dispute_outcome.png" />
      <CardMedia style={{ height: "200px" }} image="/court.png" />
      <div>
      {
        this.props.state.disputeData.map((dispute,key) => {
          if(this.props.state.disputeData[key][3]==2) {
            return(
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}> Dispute {key} </AccordionSummary>
                <AccordionDetails> Dispute settled! </AccordionDetails>
              </Accordion>
            )
          }
          else {
            return(
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}> Dispute {key} </AccordionSummary>
                <AccordionDetails> <DisputeCard id={key} state={this.props.state} handleDisputeOutcome={this.props.handleDisputeOutcome} /> </AccordionDetails>
              </Accordion>
            )
          }
        })
      }
      </div>
      </Container>
    )
  }
}

export default Betslip
