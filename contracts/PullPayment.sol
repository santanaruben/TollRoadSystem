pragma solidity ^0.5.0;

import './interfaces/PullPaymentA.sol';
import './SafeMath.sol';

contract PullPayment is PullPaymentA {

    using SafeMath for uint256;
    mapping (address => uint) internal balances;

    constructor() public {
    }

    function asyncPayTo(address whom, uint amount)
        internal
    {
        balances[whom] = balances[whom].add(amount);
    }

    function withdrawPayment()
        public
        returns(bool success)
    {
        uint amount = balances[msg.sender];
        require(amount > 0, "Not money to withdraw");
        balances[msg.sender] = 0;
        emit LogPaymentWithdrawn(msg.sender, amount);
        (bool withdrawn, ) = msg.sender.call.value(amount)("");
        require(withdrawn, "Transfer failed");
        success = true;
    }

    function getPayment(address whose)
        view
        public
        returns(uint weis)
    {
        weis = balances[whose];
    }
}