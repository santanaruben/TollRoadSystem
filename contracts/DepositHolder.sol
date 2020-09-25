pragma solidity ^0.5.0;

import "./Owned.sol";
import "./interfaces/DepositHolderI.sol";

contract DepositHolder is Owned, DepositHolderI{

    uint private _deposit;

    constructor(uint deposit) public {
        require(deposit != 0, "Deposit can not be 0");
        _deposit = deposit;
    }

    function setDeposit(uint depositWeis)
        public
        fromOwner
        returns(bool success)
    {
        require(depositWeis != 0, "Deposit can not be 0");
        require(depositWeis != _deposit, "Deposit can not be equal to the current value");
        _deposit = depositWeis;
        emit LogDepositSet(msg.sender, depositWeis);
        success = true;
    }

    function getDeposit()
        view
        public
        returns(uint weis)
    {
        weis = _deposit;
    }
}