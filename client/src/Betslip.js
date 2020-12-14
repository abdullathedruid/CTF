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
              <div>
              <IconButton color="primary" aria-label="upload picture" component="span" id={key} onClick={this.handleRemoveBet}>
                <CancelIcon id={key}/>
              </IconButton>
              {this.props.state.eventData[this.props.state.eventData.map(function(o) {return o.address;}).indexOf(bet.event)].title}
              </div>
            </ListItem>
          )
        })}
        </List>
        </div>
        Submit single bet
        <div>
        COMBO BET
        </div>

        </Container>
      )
    }
  }
}

export default Betslip
