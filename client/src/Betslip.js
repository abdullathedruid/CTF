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

  calcPrice = (e) => {
    var i=0;
    this.props.state.betslip.map((bet,key) => {
    })
    return e + ' USD'
  }

  render() {
    if(this.props.state.betslip.length==0) {
      return(
        <Container>
        <img style={{ width: "100%"}} src="dispute_outcome.png" />
        <CardMedia style={{ height: "200px" }} image="/court.png" />
        <div>
          No bets in betslip
        </div>
        </Container>
      )
    } else {
      return(
        <Container>
        <img style={{ width: "100%"}} src="dispute_outcome.png" />
        <CardMedia style={{ height: "200px" }} image="/court.png" />
        <div>
        <List>
        {this.props.state.betslip.map((bet, key)=> {
          return(
            <ListItem>
              <Container>
              <IconButton color="primary" aria-label="upload picture" component="span" id={key} onClick={this.handleRemoveBet}>
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
        COMBO BET
        Your combo bet that returns $100 will cost {this.calcPrice(100)}
        </div>

        </Container>
      )
    }
  }
}

export default Betslip
